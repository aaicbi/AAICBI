import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { del } from "@vercel/blob";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { featuredPlay } from "@/lib/growth/share";
import {
  TAP_DAILY_CAP_PER_IP, VIEW_DAILY_CAP_PER_IP, adStatus, checkAdInput, daysLeft, initialsOf, isBlobUrl, isLive, pickAds, periodFirstDay, tapRate, watBoundary, watDay,
  type AdStatus, type PaymentStatus, type Period, type Placement,
} from "@/lib/ads/adsCore";

export class AdsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const SCOPE = "ADS";
async function audit(actorId: string, action: string, scopeId = "", detail?: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType: SCOPE, scopeId, detail: detail?.slice(0, 300) ?? null } });
}

// ---------------------------------------------------------------- the switches

/** The master switch for paid ads (off until a Super Admin turns it on) and whether our own play card fills a slot when no paid ad is running. */
export async function adSettings() {
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: SCOPE, scopeId: "" } }, select: { enabled: true, config: true } });
  return { enabled: !!row?.enabled, house: ((row?.config ?? {}) as { house?: boolean }).house !== false };
}

export async function setAdSettings(actorId: string, patch: { enabled?: boolean; house?: boolean }) {
  const cur = await adSettings();
  const next = { enabled: patch.enabled ?? cur.enabled, house: patch.house ?? cur.house };
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: SCOPE, scopeId: "" } },
    create: { scopeType: SCOPE, scopeId: "", enabled: next.enabled, config: { house: next.house }, updatedById: actorId },
    update: { enabled: next.enabled, config: { house: next.house }, updatedById: actorId },
  });
  if (patch.enabled !== undefined && patch.enabled !== cur.enabled) await audit(actorId, next.enabled ? "ADS_ON" : "ADS_OFF");
  if (patch.house !== undefined && patch.house !== cur.house) await audit(actorId, next.house ? "ADS_HOUSE_ON" : "ADS_HOUSE_OFF");
}

// ---------------------------------------------------------------- stored files

/** Deletes a stored file, unless another ad still uses it (a duplicated ad shares its file). Best effort. */
async function deleteFileIfUnused(url: string | null | undefined) {
  if (!url || !isBlobUrl(url)) return;
  const used = await prisma.adBooking.count({ where: { OR: [{ mediaUrl: url }, { logoUrl: url }] } });
  if (used > 0) return;
  await del(url).catch((e) => console.error("Failed to delete an ad file:", e));
}

// ---------------------------------------------------------------- bookings

type Row = NonNullable<Awaited<ReturnType<typeof prisma.adBooking.findUnique>>>;

function view(r: Row, orgNames: Map<string, string>, now: Date) {
  return {
    id: r.id, organizationId: r.organizationId, organizationName: r.organizationId ? orgNames.get(r.organizationId) ?? null : null,
    advertiserName: r.advertiserName, advertiserKind: r.advertiserKind, logoUrl: r.logoUrl,
    headline: r.headline, caption: r.caption, buttonLabel: r.buttonLabel, linkUrl: r.linkUrl,
    mediaKind: r.mediaKind as "IMAGE" | "VIDEO", mediaUrl: r.mediaUrl, mediaType: r.mediaType, mediaName: r.mediaName, mediaSize: r.mediaSize,
    placements: r.placements as Placement[], startsOn: watDay(r.startsAt), endsOn: watDay(r.endsAt),
    priceKobo: r.priceKobo, paymentStatus: r.paymentStatus as PaymentStatus, paused: r.paused, notes: r.notes,
    status: adStatus(r, now) as AdStatus, daysLeft: daysLeft(r, now), views: r.viewsTotal, taps: r.tapsTotal, tapRate: tapRate(r.viewsTotal, r.tapsTotal),
  };
}
export type AdView = ReturnType<typeof view>;

async function orgNameMap() {
  const orgs = await prisma.trainingOrganization.findMany({ select: { id: true, name: true }, take: 500 });
  return new Map(orgs.map((o) => [o.id, o.name]));
}

export async function listAds(): Promise<{ ads: AdView[]; organizations: { id: string; name: string; logoUrl: string | null }[] }> {
  const [rows, names, orgs] = await Promise.all([
    prisma.adBooking.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    orgNameMap(),
    prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true, logoUrl: true }, take: 300 }),
  ]);
  const now = new Date();
  return { ads: rows.map((r) => view(r, names, now)), organizations: orgs };
}

async function checkedInput(raw: Record<string, unknown>) {
  const c = checkAdInput(raw);
  if (!c.ok) throw new AdsError(c.error);
  if (c.value.organizationId && !(await prisma.trainingOrganization.findUnique({ where: { id: c.value.organizationId }, select: { id: true } }))) throw new AdsError("That organization could not be found.", 404);
  return c.value;
}

function dataOf(v: Awaited<ReturnType<typeof checkedInput>>) {
  const { startsOn, endsOn, ...rest } = v;
  return { ...rest, startsAt: watBoundary(startsOn, false), endsAt: watBoundary(endsOn, true) };
}

export async function createAd(actorId: string, raw: Record<string, unknown>) {
  const v = await checkedInput(raw);
  const row = await prisma.adBooking.create({ data: { ...dataOf(v), createdById: actorId } });
  await audit(actorId, "AD_CREATED", row.id, `${v.advertiserName}: ${v.headline}`);
  return row.id;
}

export async function updateAd(actorId: string, id: string, raw: Record<string, unknown>) {
  const old = await prisma.adBooking.findUnique({ where: { id } });
  if (!old) throw new AdsError("That ad could not be found.", 404);
  const v = await checkedInput(raw);
  await prisma.adBooking.update({ where: { id }, data: dataOf(v) });
  if (old.mediaUrl !== v.mediaUrl) await deleteFileIfUnused(old.mediaUrl);
  if (old.logoUrl && old.logoUrl !== v.logoUrl) await deleteFileIfUnused(old.logoUrl);
  await audit(actorId, "AD_EDITED", id, `${v.advertiserName}: ${v.headline}`);
}

export async function setPaused(actorId: string, id: string, paused: boolean) {
  const r = await prisma.adBooking.updateMany({ where: { id }, data: { paused } });
  if (r.count === 0) throw new AdsError("That ad could not be found.", 404);
  await audit(actorId, paused ? "AD_PAUSED" : "AD_RESUMED", id);
}

export async function setPayment(actorId: string, id: string, status: PaymentStatus, priceNaira?: unknown) {
  if (!["UNPAID", "PAID", "FREE"].includes(status)) throw new AdsError("Choose paid, unpaid or free.");
  const data: { paymentStatus: PaymentStatus; priceKobo?: number | null } = { paymentStatus: status };
  if (priceNaira !== undefined && priceNaira !== null && priceNaira !== "") {
    const n = typeof priceNaira === "number" ? priceNaira : Number(String(priceNaira).replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new AdsError("The price is an amount in naira, 0 or more.");
    data.priceKobo = Math.round(n * 100);
  }
  const r = await prisma.adBooking.updateMany({ where: { id }, data });
  if (r.count === 0) throw new AdsError("That ad could not be found.", 404);
  await audit(actorId, "AD_PAYMENT", id, status);
}

export async function deleteAd(actorId: string, id: string) {
  const old = await prisma.adBooking.findUnique({ where: { id }, select: { mediaUrl: true, logoUrl: true, headline: true } });
  if (!old) throw new AdsError("That ad could not be found.", 404);
  await prisma.adBooking.delete({ where: { id } });
  await deleteFileIfUnused(old.mediaUrl);
  await deleteFileIfUnused(old.logoUrl);
  await audit(actorId, "AD_DELETED", id, old.headline);
}

// ---------------------------------------------------------------- showing ads (public)

export interface PublicAd {
  id: string;
  advertiser: { name: string; kind: string | null; logoUrl: string | null; initials: string };
  headline: string; caption: string; buttonLabel: string;
  media: { kind: "IMAGE" | "VIDEO"; url: string };
  goUrl: string;
}

/** The live ads for a place on the site (least-shown first), and our own play card as a fallback for the top and About slots. Nothing private is returned. */
export async function serveAds(o: { placement: Placement; count: number; exclude?: string[]; src?: string | null }) {
  const settings = await adSettings();
  let ads: PublicAd[] = [];
  if (settings.enabled) {
    const now = new Date();
    const rows = await prisma.adBooking.findMany({
      where: { paused: false, paymentStatus: { in: ["PAID", "FREE"] }, startsAt: { lte: now }, endsAt: { gte: now }, placements: { has: o.placement } },
      select: { id: true, viewsTotal: true, createdAt: true, advertiserName: true, advertiserKind: true, logoUrl: true, organizationId: true, headline: true, caption: true, buttonLabel: true, mediaKind: true, mediaUrl: true },
      take: 200,
    });
    const orgLogos = new Map(
      (await prisma.trainingOrganization.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.organizationId).filter((x): x is string => !!x))] } }, select: { id: true, logoUrl: true } })).map((x) => [x.id, x.logoUrl]),
    );
    ads = pickAds(rows, { count: Math.min(8, Math.max(1, o.count)), exclude: o.exclude }).map((r) => ({
      id: r.id,
      advertiser: { name: r.advertiserName, kind: r.advertiserKind, logoUrl: r.logoUrl ?? (r.organizationId ? orgLogos.get(r.organizationId) ?? null : null), initials: initialsOf(r.advertiserName) },
      headline: r.headline, caption: r.caption, buttonLabel: r.buttonLabel,
      media: { kind: r.mediaKind as "IMAGE" | "VIDEO", url: r.mediaUrl },
      goUrl: `/api/public/ads/${r.id}/go`,
    }));
  }
  const house = ads.length === 0 && settings.house && o.placement !== "INLINE" ? await featuredPlay(o.src ?? undefined) : null;
  return { ads, house: house ? { link: house.link, title: house.title } : null };
}

// ---------------------------------------------------------------- counting

async function bump(id: string, field: "views" | "taps") {
  const day = watDay(new Date());
  await prisma.adDaily.upsert({ where: { adId_day: { adId: id, day } }, create: { adId: id, day, [field]: 1 }, update: { [field]: { increment: 1 } } });
  await prisma.adBooking.update({ where: { id }, data: field === "views" ? { viewsTotal: { increment: 1 } } : { tapsTotal: { increment: 1 } } });
}

async function underCap(kind: "view" | "tap", id: string, ip: string) {
  const cap = kind === "view" ? VIEW_DAILY_CAP_PER_IP : TAP_DAILY_CAP_PER_IP;
  return (await rateLimit(`ad-${kind}:${id}:${ip}:${watDay(new Date())}`, cap, 24 * 3_600_000)).allowed;
}

/** Counts a view of a live ad. A person's browser sends one per ad per day; this also caps each address, so a script cannot inflate it. */
export async function recordView(id: string, ip: string): Promise<boolean> {
  const ad = await prisma.adBooking.findUnique({ where: { id }, select: { paused: true, paymentStatus: true, startsAt: true, endsAt: true } });
  if (!ad || !isLive(ad, new Date())) return false;
  if (!(await underCap("view", id, ip))) return false;
  await bump(id, "views");
  return true;
}

/** Counts a tap on a live ad and returns the address to open, or null when there is no such ad. An ended ad still opens its link but is not counted. */
export async function recordTap(id: string, ip: string): Promise<string | null> {
  const ad = await prisma.adBooking.findUnique({ where: { id }, select: { linkUrl: true, paused: true, paymentStatus: true, startsAt: true, endsAt: true } });
  if (!ad) return null;
  if (isLive(ad, new Date()) && (await underCap("tap", id, ip))) await bump(id, "taps");
  return ad.linkUrl;
}

// ---------------------------------------------------------------- reporting

export interface ReportViewer { userId: string; role: string }

/** A Super Admin sees every ad (optionally one organization's); an organization sees only its own. */
export async function adsReport(viewer: ReportViewer, o: { period: Period; organizationId?: string | null }, now = new Date()) {
  const isSuper = viewer.role === "SUPER_ADMIN";
  let organizationId: string | null | undefined = o.organizationId;
  if (!isSuper) {
    const org = await findTrainingOrgByStaffUserId(viewer.userId).catch(() => null);
    if (!org) return { scope: "NONE" as const, period: o.period, ads: [] as ReportAd[], totals: { views: 0, taps: 0, tapRate: 0 }, days: [] as string[] };
    organizationId = org.id;
  }
  const rows = await prisma.adBooking.findMany({ where: organizationId ? { organizationId } : {}, orderBy: { createdAt: "desc" }, take: 300 });
  const first = periodFirstDay(o.period, now);
  const daily = rows.length ? await prisma.adDaily.findMany({ where: { adId: { in: rows.map((r) => r.id) }, ...(first ? { day: { gte: first } } : {}) }, select: { adId: true, day: true, views: true, taps: true } }) : [];
  // The days on the chart: the whole period, or the last 30 days for "all time".
  const span = o.period === "7d" ? 7 : 30;
  const days = Array.from({ length: span }, (_, i) => watDay(new Date(now.getTime() - (span - 1 - i) * 86_400_000)));
  const ads = rows.map((r) => {
    const mine = daily.filter((d) => d.adId === r.id);
    const views = mine.reduce((a, d) => a + d.views, 0), taps = mine.reduce((a, d) => a + d.taps, 0);
    return { id: r.id, headline: r.headline, advertiserName: r.advertiserName, status: adStatus(r, now), startsOn: watDay(r.startsAt), endsOn: watDay(r.endsAt), daysLeft: daysLeft(r, now), views, taps, tapRate: tapRate(views, taps), series: days.map((d) => mine.find((x) => x.day === d)?.views ?? 0), tapSeries: days.map((d) => mine.find((x) => x.day === d)?.taps ?? 0), daily: mine.map((d) => ({ day: d.day, views: d.views, taps: d.taps })) };
  });
  const views = ads.reduce((a, x) => a + x.views, 0), taps = ads.reduce((a, x) => a + x.taps, 0);
  return { scope: isSuper ? ("ALL" as const) : ("OWN" as const), period: o.period, ads, totals: { views, taps, tapRate: tapRate(views, taps) }, days };
}
export type ReportAd = { id: string; headline: string; advertiserName: string; status: AdStatus; startsOn: string; endsOn: string; daysLeft: number; views: number; taps: number; tapRate: number; series: number[]; tapSeries: number[]; daily: { day: string; views: number; taps: number }[] };
