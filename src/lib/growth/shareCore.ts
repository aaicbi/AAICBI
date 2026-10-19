/**
 * The Share kit's rules, with no database: the default captions, what a caption must contain, how a caption and a share link are
 * built, the snippet for a website or email, and what an uploaded video or PDF may be.
 */
import { cleanSource } from "@/lib/growth/growthCore";

export interface Caption { id: string; label: string; text: string }

export const MAX_CAPTIONS = 12;
export const LABEL_MAX = 40;
export const TEXT_MIN = 10;
export const TEXT_MAX = 600;
export const LINK_TOKEN = "{link}";
export const COURSE_TOKEN = "{course}";

/** The captions every install starts with. Editing, adding or deleting works on a copy, and "Back to the defaults" restores these. */
export const DEFAULT_CAPTIONS: Caption[] = [
  { id: "default-clock", label: "Beat the clock", text: "⏱️ 90 seconds. 5 questions. Can you beat the clock? 👇\n{link}" },
  { id: "default-builder", label: "Think like a builder", text: "Do you think like an AI automation builder? Prove it in 90 seconds. Free, no sign-up. 🔥\nTap to play: {link}" },
  { id: "default-rank", label: "My rank", text: "I just played this and got my rank 🏆 Think you can beat me?\n{link}" },
  { id: "default-africa", label: "Africa is building", text: "Africa is building with AI. Learn it. Build it. Prove it. 🌍\nStart with a 90-second challenge, free: {link}" },
  { id: "default-group", label: "Group challenge", text: "Group challenge! 🏆 Everyone in this group, tap and play. Who gets the top rank?\n{link}" },
];

export type CaptionCheck = { ok: true; label: string; text: string } | { ok: false; error: string };

/** A caption needs a name, some text, and a {link} for the funnel address to go in. */
export function checkCaption(input: { label?: unknown; text?: unknown }): CaptionCheck {
  const label = typeof input.label === "string" ? input.label.replace(/\s+/g, " ").trim() : "";
  // eslint-disable-next-line no-control-regex
  const text = typeof input.text === "string" ? input.text.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim() : "";
  if (!label) return { ok: false, error: "Give the caption a short name." };
  if (label.length > LABEL_MAX) return { ok: false, error: `The name is at most ${LABEL_MAX} characters.` };
  if (text.length < TEXT_MIN) return { ok: false, error: "Write the caption text." };
  if (text.length > TEXT_MAX) return { ok: false, error: `A caption is at most ${TEXT_MAX} characters.` };
  if (!text.includes(LINK_TOKEN)) return { ok: false, error: `Put ${LINK_TOKEN} where the funnel link should go. It is filled in for you when you copy.` };
  return { ok: true, label, text };
}

/** The caption as it will be pasted: the course's funnel link (and name) filled in. */
export function renderCaption(text: string, v: { link: string; course: string }): string {
  return text.split(LINK_TOKEN).join(v.link).split(COURSE_TOKEN).join(v.course);
}

/** The course's funnel link, with the source label so the Growth report shows where each player came from. */
export function shareLink(base: string, slug: string, src?: unknown): string {
  const clean = cleanSource(src);
  return `${base.replace(/\/$/, "")}/play/${slug}${clean ? `?src=${clean}` : ""}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Code for a website or an email: the animated card, clickable, linking to the funnel. */
export function embedSnippet(o: { link: string; imageUrl: string; alt: string; width?: number }): string {
  return `<a href="${esc(o.link)}" target="_blank" rel="noopener"><img src="${esc(o.imageUrl)}" alt="${esc(o.alt)}" width="${o.width ?? 600}" style="max-width:100%;height:auto;border:0"></a>`;
}

export type AssetKind = "video" | "pdf";
export interface Asset { url: string; name: string; size: number; contentType: string; uploadedAt: string }

export const ASSET_RULES: Record<AssetKind, { types: string[]; maxBytes: number; label: string }> = {
  video: { types: ["video/mp4", "video/quicktime", "video/webm"], maxBytes: 100 * 1024 * 1024, label: "video (MP4, MOV or WebM, up to 100 MB)" },
  pdf: { types: ["application/pdf"], maxBytes: 25 * 1024 * 1024, label: "PDF (up to 25 MB)" },
};
export const assetPrefix = (kind: AssetKind) => `growth-share/${kind}/`;
export const isAssetKind = (v: unknown): v is AssetKind => v === "video" || v === "pdf";

/** A file already stored in this app's own file storage (never a link to somewhere else), of the right kind and size. */
export function checkAsset(kind: AssetKind, input: { url?: unknown; name?: unknown; size?: unknown; contentType?: unknown }): { ok: true; asset: Omit<Asset, "uploadedAt"> } | { ok: false; error: string } {
  const rules = ASSET_RULES[kind];
  const url = typeof input.url === "string" ? input.url : "";
  let host = "";
  try { const u = new URL(url); host = u.protocol === "https:" ? u.hostname : ""; } catch { /* not a url */ }
  if (!host.endsWith(".public.blob.vercel-storage.com")) return { ok: false, error: "That file was not stored by this app. Upload it again." };
  const contentType = typeof input.contentType === "string" ? input.contentType.toLowerCase() : "";
  if (!rules.types.includes(contentType)) return { ok: false, error: `That is not a ${rules.label}.` };
  const size = typeof input.size === "number" && Number.isFinite(input.size) ? Math.floor(input.size) : -1;
  if (size <= 0 || size > rules.maxBytes) return { ok: false, error: `The file must be a ${rules.label}.` };
  const name = (typeof input.name === "string" ? input.name : "file").split(/[\\/]/).pop()?.replace(/[^\w .()-]+/g, "").trim().slice(0, 120) || "file";
  return { ok: true, asset: { url, name, size, contentType } };
}

export const prettySize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
