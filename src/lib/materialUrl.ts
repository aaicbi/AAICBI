import { z } from "zod";

/**
 * z.string().url() alone is not enough — it accepts anything the WHATWG
 * URL constructor parses, which includes javascript: and data: schemes.
 * Verified directly before writing this: z.string().url() ACCEPTS
 * "javascript:alert(1)" and "data:text/html,<script>alert(1)</script>".
 * Since material URLs render straight into an href on the trainee-facing
 * course page, an unrestricted scheme is a stored-XSS vector reachable
 * by any staff account (compromised or malicious) against every
 * trainee who clicks the link. This restricts to http/https only.
 */
export const safeUrl = z
  .string()
  .url("Enter a valid URL.")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must start with http:// or https://");

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"]);
const GOOGLE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

/**
 * For VIDEO materials specifically: YouTube or Google-hosted (Drive),
 * matching the roadmap's own M40 decision — video no longer needs to
 * be YouTube-exclusive, since a genuine offline-download feature needs
 * at least one source it can actually fetch raw file bytes from
 * server-side, which YouTube's own Terms of Service don't allow for.
 * Enforcing the host still matters for the same reason as before —
 * reliable ID extraction for the YouTube embedded player specifically
 * (see extractYouTubeId below) — but a Google-hosted video that isn't
 * a recognized YouTube shape already falls back to a plain link in the
 * trainee-facing player, not a broken embed, confirmed directly before
 * relying on it.
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return YOUTUBE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function isGoogleHostedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return GOOGLE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * The actual, current rule for what a VIDEO material's URL is allowed
 * to be — YouTube or Google-hosted, nothing else. A single, shared
 * function so the create-time validator and anything else that needs
 * this rule can't drift apart from each other over time.
 */
export function isAllowedVideoUrl(url: string): boolean {
  return isYouTubeUrl(url) || isGoogleHostedUrl(url);
}

/**
 * Extracts a Google Drive file ID from the common share-link shape
 * (`/file/d/{id}/view`, `/file/d/{id}/preview`, etc.) — the only Drive
 * URL shape a video material would realistically ever have; a
 * `docs.google.com` link (Slides, Sheets) isn't a video source and
 * correctly returns null here, falling through to a plain link the
 * same way an unrecognized YouTube shape already does. Returns null on
 * anything unexpected rather than guessing, same discipline as
 * extractYouTubeId below.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "drive.google.com") return null;
    const match = parsed.pathname.match(/^\/file\/d\/([\w-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extracts an embeddable YouTube video ID from the common URL shapes
 * (watch?v=, youtu.be/, /embed/). Returns null on anything unexpected
 * rather than guessing — callers must fall back to a plain link rather
 * than risk a broken or wrong embed.
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id || null;
    }
    if (YOUTUBE_HOSTS.has(parsed.hostname)) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const embedMatch = parsed.pathname.match(/^\/embed\/([\w-]+)/);
      if (embedMatch) return embedMatch[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * M40 — the actual URL to fetch for a genuine, raw-bytes download,
 * which is NOT the same URL stored on the material for a Drive-hosted
 * file: `/file/d/{id}/view` and `/file/d/{id}/preview` are Drive's own
 * interactive viewer pages, not a file endpoint — fetching either
 * server-side would just return HTML, always failing a real download
 * attempt even for a genuinely valid file. `uc?export=download&id=`
 * is the real, confirmed-directly (not guessed) raw-download URL
 * format. Returns the material's own URL unchanged for anything that
 * isn't a Drive link — a direct PDF/DOCX/PPTX link is already the
 * right thing to fetch as-is.
 */
export function resolveDownloadUrl(materialUrl: string): string {
  const fileId = extractGoogleDriveFileId(materialUrl);
  if (fileId) return `https://drive.google.com/uc?export=download&id=${fileId}`;
  return materialUrl;
}
