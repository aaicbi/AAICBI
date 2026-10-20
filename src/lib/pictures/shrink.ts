import sharp from "sharp";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { isBlobUrl } from "@/lib/ads/adsCore";
import { KINDS, MAX_WIDTH, worthChecking, worthReplacing, type PictureKind } from "@/lib/pictures/core";

/** Resizes to at most `maxWidth` (never enlarging), turns a phone photo the right way up, and saves it as WebP. */
export async function shrinkBuffer(input: Buffer, maxWidth: number): Promise<{ buffer: Buffer; width: number; height: number }> {
  const out = await sharp(input, { failOn: "none" }).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

interface Row { id: string; url: string }

/** Every stored picture of one kind that this app holds in its own storage. */
async function rowsOf(kind: PictureKind): Promise<Row[]> {
  const pick = <T extends { id: string }>(rows: T[], f: (r: T) => string | null): Row[] => rows.flatMap((r) => { const u = f(r); return u && isBlobUrl(u) ? [{ id: r.id, url: u }] : []; });
  switch (kind) {
    case "USER_AVATAR": return pick(await prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { id: true, avatarUrl: true }, take: 2000 }), (r) => r.avatarUrl);
    case "TRAINEE_AVATAR": return pick(await prisma.trainee.findMany({ where: { avatarUrl: { not: null } }, select: { id: true, avatarUrl: true }, take: 5000 }), (r) => r.avatarUrl);
    case "ORG_LOGO": return pick(await prisma.trainingOrganization.findMany({ where: { logoUrl: { not: null } }, select: { id: true, logoUrl: true }, take: 2000 }), (r) => r.logoUrl);
    case "EMPLOYER_LOGO": return pick(await prisma.employer.findMany({ where: { logoUrl: { not: null } }, select: { id: true, logoUrl: true }, take: 2000 }), (r) => r.logoUrl);
    case "STARTUP_LOGO": return pick(await prisma.startup.findMany({ where: { logoUrl: { not: null } }, select: { id: true, logoUrl: true }, take: 2000 }), (r) => r.logoUrl);
    case "COURSE_FLYER": return pick(await prisma.course.findMany({ where: { flyerUrl: { not: null } }, select: { id: true, flyerUrl: true }, take: 2000 }), (r) => r.flyerUrl);
    case "ORG_COVER": return pick(await prisma.organizationPublicProfile.findMany({ where: { coverUrl: { not: null } }, select: { id: true, coverUrl: true }, take: 2000 }), (r) => r.coverUrl);
  }
}

async function setUrl(kind: PictureKind, id: string, url: string) {
  switch (kind) {
    case "USER_AVATAR": return void (await prisma.user.update({ where: { id }, data: { avatarUrl: url } }));
    case "TRAINEE_AVATAR": return void (await prisma.trainee.update({ where: { id }, data: { avatarUrl: url } }));
    case "ORG_LOGO": return void (await prisma.trainingOrganization.update({ where: { id }, data: { logoUrl: url } }));
    case "EMPLOYER_LOGO": return void (await prisma.employer.update({ where: { id }, data: { logoUrl: url } }));
    case "STARTUP_LOGO": return void (await prisma.startup.update({ where: { id }, data: { logoUrl: url } }));
    case "COURSE_FLYER": return void (await prisma.course.update({ where: { id }, data: { flyerUrl: url } }));
    case "ORG_COVER": return void (await prisma.organizationPublicProfile.update({ where: { id }, data: { coverUrl: url } }));
  }
}

/** True when some other record (of any kind, including a certificate template or an ad) still points at this file. */
async function stillUsed(url: string): Promise<boolean> {
  const n = await Promise.all([
    prisma.user.count({ where: { avatarUrl: url } }), prisma.trainee.count({ where: { avatarUrl: url } }), prisma.trainingOrganization.count({ where: { logoUrl: url } }),
    prisma.employer.count({ where: { logoUrl: url } }), prisma.startup.count({ where: { logoUrl: url } }), prisma.course.count({ where: { flyerUrl: url } }),
    prisma.organizationPublicProfile.count({ where: { coverUrl: url } }), prisma.certificateTemplate.count({ where: { logoUrl: url } }), prisma.adBooking.count({ where: { OR: [{ mediaUrl: url }, { logoUrl: url }] } }),
  ]);
  return n.some((x) => x > 0);
}

async function sizeOf(url: string): Promise<number> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok ? Number(r.headers.get("content-length")) || 0 : 0;
  } catch { return 0; }
}

async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const SCOPE = "PICTURES";
const SKIP_MAX = 1000;
/** Pictures looked at and left alone (already as small as they can reasonably get, or unreadable), so they are not looked at again every time. */
async function skipped(): Promise<Set<string>> {
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: SCOPE, scopeId: "" } }, select: { config: true } });
  const list = ((row?.config ?? {}) as { skip?: unknown }).skip;
  return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
}
async function remember(actorId: string, urls: string[]) {
  if (urls.length === 0) return;
  const all = [...(await skipped()), ...urls].slice(-SKIP_MAX);
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: SCOPE, scopeId: "" } },
    create: { scopeType: SCOPE, scopeId: "", enabled: true, config: { skip: all }, updatedById: actorId },
    update: { config: { skip: all }, updatedById: actorId },
  });
}

export interface Candidate { kind: PictureKind; id: string; url: string; bytes: number }
export interface Scan { total: number; large: number; largeBytes: number; byKind: Array<{ kind: PictureKind; total: number; large: number; bytes: number }>; candidates: Candidate[] }

/** Looks at every stored picture (sizes only, nothing is downloaded) and lists the ones big enough to be worth shrinking, largest first. */
export async function scanPictures(): Promise<Scan> {
  const skip = await skipped();
  const byKind: Scan["byKind"] = [];
  const candidates: Candidate[] = [];
  let total = 0;
  for (const kind of KINDS) {
    const rows = await rowsOf(kind);
    const sized = await inBatches(rows, 12, async (r) => ({ ...r, bytes: await sizeOf(r.url) }));
    const large = sized.filter((r) => worthChecking(kind, r.bytes) && !skip.has(r.url));
    total += rows.length;
    byKind.push({ kind, total: rows.length, large: large.length, bytes: large.reduce((a, r) => a + r.bytes, 0) });
    candidates.push(...large.map((r) => ({ kind, ...r })));
  }
  candidates.sort((a, b) => b.bytes - a.bytes);
  return { total, large: candidates.length, largeBytes: candidates.reduce((a, c) => a + c.bytes, 0), byKind, candidates };
}

export interface ShrinkReport { tried: number; shrunk: number; unchanged: number; failed: number; savedBytes: number }
export type ShrinkResult = ShrinkReport & { left: string[] };

/**
 * Shrinks up to `limit` of the largest pictures (and stops early at `budgetMs`): downloads each, saves a smaller WebP under a new
 * name, points the record at it, then removes the old file when nothing else uses it. The old file is only removed after the record
 * has been updated, so a failure part-way never leaves a broken picture.
 */
export async function shrinkBatch(actorId: string, candidates: Candidate[], limit = 12, budgetMs = 40_000): Promise<ShrinkReport> {
  const left: string[] = [];
  const started = Date.now();
  const report: ShrinkReport = { tried: 0, shrunk: 0, unchanged: 0, failed: 0, savedBytes: 0 };
  for (const c of candidates) {
    if (report.tried >= limit || Date.now() - started > budgetMs) break;
    report.tried++;
    try {
      const res = await fetch(c.url, { cache: "no-store" });
      if (!res.ok) { report.failed++; left.push(c.url); continue; }
      const input = Buffer.from(await res.arrayBuffer());
      const out = await shrinkBuffer(input, MAX_WIDTH[c.kind]);
      if (!worthReplacing(input.length, out.buffer.length)) { report.unchanged++; left.push(c.url); continue; }
      const blob = await put(`pictures/${c.kind.toLowerCase()}-${c.id}-${Date.now()}.webp`, out.buffer, { access: "public", addRandomSuffix: true, contentType: "image/webp" });
      await setUrl(c.kind, c.id, blob.url);
      if (!(await stillUsed(c.url))) await del(c.url).catch((e) => console.error("Could not delete the old picture:", e));
      report.shrunk++;
      report.savedBytes += input.length - out.buffer.length;
    } catch (e) {
      console.error("Could not shrink a picture:", c.kind, c.id, e);
      report.failed++;
      left.push(c.url);
    }
  }
  await remember(actorId, left);
  await prisma.growthAudit.create({ data: { actorId, action: "PICTURES_SHRUNK", scopeType: SCOPE, scopeId: "", detail: `${report.shrunk} shrunk, ${report.unchanged} left as they were, ${report.failed} failed, ${report.savedBytes} bytes saved` } });
  return report;
}
