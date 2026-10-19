import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { deleteLessonMaterialBestEffort } from "@/lib/lessonMaterial";
import { GrowthError, courseGrowth } from "@/lib/growth/growth";
import { FEATURED_TTL_MS, featuredCache } from "@/lib/growth/featuredCache";
import { DEFAULT_CAPTIONS, MAX_CAPTIONS, checkAsset, checkCaption, shareLink, type Asset, type AssetKind, type Caption } from "@/lib/growth/shareCore";

const CAPTIONS_SCOPE = "SHARE";
const ASSETS_SCOPE = "SHARE_ASSETS";

async function audit(actorId: string, action: string, scopeId: string, detail?: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType: "SHARE", scopeId, detail: detail?.slice(0, 300) ?? null } });
}

// ---------------------------------------------------------------- captions

function validList(raw: unknown): Caption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Caption[] = [];
  for (const c of raw) {
    const o = c as Partial<Caption>;
    if (typeof o?.id === "string" && typeof o.label === "string" && typeof o.text === "string") out.push({ id: o.id, label: o.label, text: o.text });
  }
  return out.length ? out : null;
}

/** The captions in use: the saved list when the Super Admin has edited them, otherwise the defaults. */
export async function getCaptions(): Promise<{ captions: Caption[]; isDefault: boolean }> {
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: CAPTIONS_SCOPE, scopeId: "" } }, select: { config: true } });
  const saved = validList(((row?.config ?? {}) as { captions?: unknown }).captions);
  return saved ? { captions: saved, isDefault: false } : { captions: DEFAULT_CAPTIONS.map((c) => ({ ...c })), isDefault: true };
}

async function writeCaptions(actorId: string, captions: Caption[] | null) {
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: CAPTIONS_SCOPE, scopeId: "" } },
    create: { scopeType: CAPTIONS_SCOPE, scopeId: "", enabled: false, config: (captions ? { captions } : {}) as object, updatedById: actorId },
    update: { config: (captions ? { captions } : {}) as object, updatedById: actorId },
  });
}

/** Edits a caption (when its id is known) or adds a new one. */
export async function saveCaption(actorId: string, input: { id?: unknown; label?: unknown; text?: unknown }) {
  const c = checkCaption(input);
  if (!c.ok) throw new GrowthError(c.error);
  const { captions } = await getCaptions();
  const id = typeof input.id === "string" ? input.id : "";
  const at = captions.findIndex((x) => x.id === id);
  if (at >= 0) captions[at] = { id, label: c.label, text: c.text };
  else {
    if (captions.length >= MAX_CAPTIONS) throw new GrowthError(`You can keep up to ${MAX_CAPTIONS} captions. Delete one first.`, 409);
    captions.push({ id: `c-${randomBytes(5).toString("hex")}`, label: c.label, text: c.text });
  }
  await writeCaptions(actorId, captions);
  await audit(actorId, "SHARE_CAPTION_SAVED", "", c.label);
}

export async function deleteCaption(actorId: string, id: unknown) {
  const { captions } = await getCaptions();
  const next = captions.filter((c) => c.id !== id);
  if (next.length === captions.length) throw new GrowthError("That caption could not be found.", 404);
  if (next.length === 0) throw new GrowthError("Keep at least one caption. You can also go back to the defaults.", 409);
  await writeCaptions(actorId, next);
  await audit(actorId, "SHARE_CAPTION_DELETED", "", captions.find((c) => c.id === id)?.label);
}

export async function resetCaptions(actorId: string) {
  await writeCaptions(actorId, null);
  await audit(actorId, "SHARE_CAPTIONS_RESET", "");
}

// ---------------------------------------------------------------- the files a Super Admin uploads for a course

type AssetMap = Partial<Record<AssetKind, Asset>>;

async function assetsOf(courseId: string): Promise<AssetMap> {
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: ASSETS_SCOPE, scopeId: courseId } }, select: { config: true } });
  return ((row?.config ?? {}) as AssetMap) ?? {};
}

async function writeAssets(actorId: string, courseId: string, assets: AssetMap) {
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: ASSETS_SCOPE, scopeId: courseId } },
    create: { scopeType: ASSETS_SCOPE, scopeId: courseId, enabled: false, config: assets as object, updatedById: actorId },
    update: { config: assets as object, updatedById: actorId },
  });
}

/** Records a file the browser has already uploaded straight to storage, replacing (and deleting) the course's earlier one of that kind. */
export async function setAsset(actorId: string, courseId: string, kind: AssetKind, input: { url?: unknown; name?: unknown; size?: unknown; contentType?: unknown }) {
  const campaign = await prisma.growthCampaign.findUnique({ where: { courseId }, select: { id: true, course: { select: { title: true } } } });
  if (!campaign) throw new GrowthError("That course has no campaign yet.", 404);
  const c = checkAsset(kind, input);
  if (!c.ok) throw new GrowthError(c.error);
  const assets = await assetsOf(courseId);
  const old = assets[kind];
  assets[kind] = { ...c.asset, uploadedAt: new Date().toISOString() };
  await writeAssets(actorId, courseId, assets);
  if (old && old.url !== c.asset.url) await deleteLessonMaterialBestEffort(old.url);
  await audit(actorId, "SHARE_FILE_SET", courseId, `${campaign.course.title}: ${kind} ${c.asset.name}`);
}

export async function removeAsset(actorId: string, courseId: string, kind: AssetKind) {
  const assets = await assetsOf(courseId);
  const old = assets[kind];
  if (!old) return;
  delete assets[kind];
  await writeAssets(actorId, courseId, assets);
  await deleteLessonMaterialBestEffort(old.url);
  await audit(actorId, "SHARE_FILE_REMOVED", courseId, `${kind} ${old.name}`);
}

// ---------------------------------------------------------------- what the screen needs

/** The courses whose link is live right now, each with its funnel link and any files uploaded for it. */
export async function shareCourses() {
  const campaigns = await prisma.growthCampaign.findMany({ where: { enabled: true }, select: { courseId: true, slug: true, course: { select: { title: true } } }, orderBy: { createdAt: "asc" }, take: 100 });
  const out: { id: string; title: string; slug: string; link: string; assets: AssetMap }[] = [];
  for (const c of campaigns) {
    if (!(await courseGrowth(c.courseId)).live) continue;
    out.push({ id: c.courseId, title: c.course.title, slug: c.slug, link: shareLink(appUrl(""), c.slug), assets: await assetsOf(c.courseId) });
  }
  return out;
}

/** The funnel link for one course's campaign (it exists even when the link is switched off, so a PDF can be prepared early). */
export async function courseShareTarget(courseId: string, src?: unknown) {
  const c = await prisma.growthCampaign.findUnique({ where: { courseId }, select: { slug: true, course: { select: { title: true } } } });
  if (!c) return null;
  return { title: c.course.title, link: shareLink(appUrl(""), c.slug, src) };
}

// ---------------------------------------------------------------- the card on the public About page

/** The course whose funnel link the About page should offer: AAICBI's own courses first, otherwise any live one. Remembered for a minute. */
export async function featuredPlay(src?: unknown): Promise<{ link: string; title: string } | null> {
  const now = Date.now();
  if (featuredCache.at === 0 || now - featuredCache.at > FEATURED_TTL_MS) {
    const campaigns = await prisma.growthCampaign.findMany({ where: { enabled: true }, select: { courseId: true, slug: true, course: { select: { title: true } } }, orderBy: { createdAt: "asc" }, take: 50 });
    let own: { slug: string; title: string } | null = null;
    let any: { slug: string; title: string } | null = null;
    for (const c of campaigns) {
      const g = await courseGrowth(c.courseId);
      if (!g.live) continue;
      const pick = { slug: c.slug, title: c.course.title };
      if (!g.organizationId) { own = pick; break; }
      any = any ?? pick;
    }
    featuredCache.at = now;
    featuredCache.value = own ?? any;
  }
  const v = featuredCache.value;
  return v ? { link: shareLink(appUrl(""), v.slug, src), title: v.title } : null;
}
