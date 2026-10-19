/**
 * Sponsored ads, as pure rules (no database): what an ad may contain, whether it is live, which ads to show, and how views and taps are counted.
 * Dates are Nigerian time (WAT, UTC+1): an ad runs from the start of its first day to the end of its last.
 */

export const HEADLINE_MAX = 60;
export const CAPTION_MAX = 140;
export const BUTTON_MAX = 24;
export const NAME_MAX = 60;
export const KIND_MAX = 40;
export const NOTES_MAX = 500;
export const INLINE_EVERY = 6;

export type Placement = "TOP" | "INLINE" | "ABOUT";
export const PLACEMENTS: Placement[] = ["TOP", "INLINE", "ABOUT"];
export const PLACEMENT_LABEL: Record<Placement, string> = { TOP: "Top of the feed", INLINE: "In the feed, after every 6 posts", ABOUT: "The About page" };
export type PaymentStatus = "UNPAID" | "PAID" | "FREE";
export const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "PAID", "FREE"];
export type AdStatus = "WAITING_PAYMENT" | "PAUSED" | "SCHEDULED" | "LIVE" | "ENDED";
export const STATUS_LABEL: Record<AdStatus, string> = { WAITING_PAYMENT: "Waiting for payment", PAUSED: "Paused", SCHEDULED: "Scheduled", LIVE: "Live", ENDED: "Ended" };

export type MediaKind = "IMAGE" | "VIDEO";
export const MEDIA_RULES: Record<MediaKind | "LOGO", { types: string[]; maxBytes: number; label: string }> = {
  IMAGE: { types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 5 * 1024 * 1024, label: "image (JPG, PNG, WebP or GIF, up to 5 MB)" },
  VIDEO: { types: ["video/mp4", "video/webm"], maxBytes: 30 * 1024 * 1024, label: "video (MP4 or WebM, up to 30 MB)" },
  LOGO: { types: ["image/jpeg", "image/png", "image/webp"], maxBytes: 1024 * 1024, label: "logo (JPG, PNG or WebP, up to 1 MB)" },
};
export const mediaPrefix = (k: "image" | "video" | "logo") => `ads/${k}/`;

/** Only a file this app stored itself (never a link to somewhere else). */
export function isBlobUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try { const u = new URL(url); return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com"); } catch { return false; }
}

/** A plain https address with no embedded login, so a tap can only ever go where the Super Admin typed. */
export function checkLink(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: false, error: "Add the link the button opens." };
  if (s.length > 500) return { ok: false, error: "That link is too long." };
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return { ok: false, error: "The link must start with https://" };
    if (u.username || u.password) return { ok: false, error: "The link must not contain a login." };
    if (!u.hostname.includes(".")) return { ok: false, error: "That does not look like a web address." };
    return { ok: true, url: u.toString() };
  } catch { return { ok: false, error: "That does not look like a web address." }; }
}

const clean = (v: unknown, max: number) =>
  // eslint-disable-next-line no-control-regex
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim().slice(0, max + 1) : "";

// ---------------------------------------------------------------- Nigerian time

const WAT_MS = 3_600_000;
/** 'YYYY-MM-DD' for a moment, in Nigerian time. */
export function watDay(d: Date): string { return new Date(d.getTime() + WAT_MS).toISOString().slice(0, 10); }
/** The start (or the very end) of a Nigerian day, as a moment. */
export function watBoundary(day: string, end: boolean): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0) - WAT_MS);
}
export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));

// ---------------------------------------------------------------- the booking form

export interface AdInput {
  organizationId: string | null; advertiserName: string; advertiserKind: string | null; logoUrl: string | null;
  headline: string; caption: string; buttonLabel: string; linkUrl: string;
  mediaKind: MediaKind; mediaUrl: string; mediaType: string; mediaName: string; mediaSize: number;
  placements: Placement[]; startsOn: string; endsOn: string; priceKobo: number | null; paymentStatus: PaymentStatus; notes: string | null;
}

export function checkAdInput(r: Record<string, unknown>): { ok: true; value: AdInput } | { ok: false; error: string } {
  const advertiserName = clean(r.advertiserName, NAME_MAX);
  if (!advertiserName) return { ok: false, error: "Add the advertiser's name." };
  if (advertiserName.length > NAME_MAX) return { ok: false, error: `The advertiser's name is at most ${NAME_MAX} characters.` };
  const advertiserKind = clean(r.advertiserKind, KIND_MAX) || null;
  if (advertiserKind && advertiserKind.length > KIND_MAX) return { ok: false, error: `The advertiser type is at most ${KIND_MAX} characters.` };
  const headline = clean(r.headline, HEADLINE_MAX);
  if (!headline) return { ok: false, error: "Write a headline." };
  if (headline.length > HEADLINE_MAX) return { ok: false, error: `The headline is at most ${HEADLINE_MAX} characters.` };
  const caption = clean(r.caption, CAPTION_MAX);
  if (!caption) return { ok: false, error: "Write a short caption." };
  if (caption.length > CAPTION_MAX) return { ok: false, error: `The caption is at most ${CAPTION_MAX} characters.` };
  const buttonLabel = clean(r.buttonLabel, BUTTON_MAX);
  if (!buttonLabel) return { ok: false, error: "Write the words on the button." };
  if (buttonLabel.length > BUTTON_MAX) return { ok: false, error: `The button words are at most ${BUTTON_MAX} characters.` };
  const link = checkLink(r.linkUrl);
  if (!link.ok) return link;

  const kind = r.mediaKind === "VIDEO" ? "VIDEO" : r.mediaKind === "IMAGE" ? "IMAGE" : null;
  if (!kind) return { ok: false, error: "Upload an image or a video." };
  const rules = MEDIA_RULES[kind];
  const mediaType = typeof r.mediaType === "string" ? r.mediaType.toLowerCase() : "";
  const mediaSize = typeof r.mediaSize === "number" && Number.isFinite(r.mediaSize) ? Math.floor(r.mediaSize) : -1;
  if (!isBlobUrl(r.mediaUrl)) return { ok: false, error: "That file was not stored by this app. Upload it again." };
  const a = kind === "IMAGE" ? "an" : "a";
  if (!rules.types.includes(mediaType)) return { ok: false, error: `That is not ${a} ${rules.label}.` };
  if (mediaSize <= 0 || mediaSize > rules.maxBytes) return { ok: false, error: `The file must be ${a} ${rules.label}.` };
  const mediaName = (typeof r.mediaName === "string" ? r.mediaName : "file").split(/[\\/]/).pop()?.replace(/[^\w .()-]+/g, "").trim().slice(0, 120) || "file";

  let logoUrl: string | null = null;
  if (r.logoUrl !== undefined && r.logoUrl !== null && r.logoUrl !== "") {
    if (!isBlobUrl(r.logoUrl)) return { ok: false, error: "That logo was not stored by this app. Upload it again." };
    logoUrl = r.logoUrl;
  }

  const placements = (Array.isArray(r.placements) ? r.placements : []).filter((p): p is Placement => PLACEMENTS.includes(p as Placement));
  const unique = [...new Set(placements)];
  if (unique.length === 0) return { ok: false, error: "Choose where the ad shows." };

  if (!isDay(r.startsOn) || !isDay(r.endsOn)) return { ok: false, error: "Choose the first and last day." };
  if (r.endsOn < r.startsOn) return { ok: false, error: "The last day cannot be before the first day." };
  const days = (Date.parse(r.endsOn + "T00:00:00Z") - Date.parse(r.startsOn + "T00:00:00Z")) / 86_400_000;
  if (days > 366) return { ok: false, error: "An ad can run for at most a year." };

  const paymentStatus = PAYMENT_STATUSES.includes(r.paymentStatus as PaymentStatus) ? (r.paymentStatus as PaymentStatus) : "UNPAID";
  let priceKobo: number | null = null;
  if (r.priceNaira !== undefined && r.priceNaira !== null && r.priceNaira !== "") {
    const n = typeof r.priceNaira === "number" ? r.priceNaira : Number(String(r.priceNaira).replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return { ok: false, error: "The price is an amount in naira, 0 or more." };
    priceKobo = Math.round(n * 100);
  }
  const notes = clean(r.notes, NOTES_MAX) || null;
  if (notes && notes.length > NOTES_MAX) return { ok: false, error: `Notes are at most ${NOTES_MAX} characters.` };
  const organizationId = typeof r.organizationId === "string" && r.organizationId.trim() ? r.organizationId.trim().slice(0, 60) : null;

  return { ok: true, value: { organizationId, advertiserName, advertiserKind, logoUrl, headline, caption, buttonLabel, linkUrl: link.url, mediaKind: kind, mediaUrl: r.mediaUrl, mediaType, mediaName, mediaSize, placements: unique, startsOn: r.startsOn, endsOn: r.endsOn, priceKobo, paymentStatus, notes } };
}

// ---------------------------------------------------------------- is it live

export interface AdLike { paymentStatus: string; paused: boolean; startsAt: Date; endsAt: Date }

/** Ended wins over everything; then paused; then waiting for payment; then scheduled; otherwise live. */
export function adStatus(ad: AdLike, now: Date): AdStatus {
  if (now > ad.endsAt) return "ENDED";
  if (ad.paused) return "PAUSED";
  if (ad.paymentStatus !== "PAID" && ad.paymentStatus !== "FREE") return "WAITING_PAYMENT";
  if (now < ad.startsAt) return "SCHEDULED";
  return "LIVE";
}
export const isLive = (ad: AdLike, now: Date) => adStatus(ad, now) === "LIVE";
export function daysLeft(ad: { endsAt: Date }, now: Date): number { return Math.max(0, Math.ceil((ad.endsAt.getTime() - now.getTime()) / 86_400_000)); }

// ---------------------------------------------------------------- which ads to show

export interface Candidate { id: string; viewsTotal: number; createdAt: Date }

/** The least-shown ads first (so every paid ad gets its share), skipping any already used, and never the same one twice in a row. */
export function pickAds<T extends Candidate>(candidates: T[], o: { count: number; exclude?: string[]; lastId?: string | null }): T[] {
  const skip = new Set(o.exclude ?? []);
  const pool = candidates.filter((c) => !skip.has(c.id)).sort((a, b) => a.viewsTotal - b.viewsTotal || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const out = pool.slice(0, Math.max(0, o.count));
  if (out.length > 1 && o.lastId && out[0].id === o.lastId) out.push(out.shift() as T);
  return out;
}

/** The ad for slot number `n` (0, 1, 2...) in a list of ads, cycling, so two neighbouring slots differ whenever there is more than one ad. */
export function adForSlot<T>(ads: T[], n: number): T | null { return ads.length ? ads[n % ads.length] : null; }

/** Where the in-feed slots go: after every `every` posts, as the 1-based number of posts before each slot. */
export function inlineSlotAfter(postCount: number, every = INLINE_EVERY): number[] {
  const out: number[] = [];
  for (let n = every; n <= postCount; n += every) out.push(n);
  return out;
}

// ---------------------------------------------------------------- counting and reporting

export const VIEW_DAILY_CAP_PER_IP = 20;
export const TAP_DAILY_CAP_PER_IP = 30;
export const tapRate = (views: number, taps: number) => (views > 0 ? Math.round((taps / views) * 1000) / 10 : 0);
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "AD";
export const prettyNaira = (kobo: number | null) => (kobo == null ? "" : `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`);

export const PERIODS = ["7d", "30d", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const cleanPeriod = (raw: unknown): Period => ((PERIODS as readonly string[]).includes(raw as string) ? (raw as Period) : "30d");
/** The first Nigerian day inside a period, or null for all time. */
export function periodFirstDay(period: Period, now: Date): string | null {
  if (period === "all") return null;
  return watDay(new Date(now.getTime() - (period === "7d" ? 6 : 29) * 86_400_000));
}
/** A spreadsheet cell, made safe against being read as a formula. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (head: string[], rows: unknown[][]) => [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
