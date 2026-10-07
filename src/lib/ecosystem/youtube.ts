import { extractYouTubeId, isYouTubeUrl } from "@/lib/materialUrl";

export interface ParsedYouTube {
  id: string;
  /** Canonical watch URL — what we store, instead of whatever shape was pasted. */
  watchUrl: string;
  thumbnailUrl: string;
  /** Privacy-enhanced embed host: no tracking cookies until the viewer plays. */
  embedUrl: string;
}

const ID_PATTERN = /^[\w-]{11}$/;

/**
 * Validates a pasted YouTube link and extracts the video id. Reuses the
 * existing lesson-material validator (host allow-list + extractYouTubeId)
 * and additionally accepts /shorts/ and /live/ links, which that helper
 * does not. Nothing is downloaded or re-hosted: we keep only the id and
 * derive the thumbnail and embed URLs from it.
 */
export function parseYouTubeUrl(raw: string): ParsedYouTube | null {
  const url = raw.trim();
  if (!isYouTubeUrl(url)) return null;
  let id = extractYouTubeId(url);
  if (!id) {
    try {
      const m = new URL(url).pathname.match(/^\/(?:shorts|live)\/([\w-]+)/);
      id = m ? m[1] : null;
    } catch {
      id = null;
    }
  }
  if (!id || !ID_PATTERN.test(id)) return null;
  return {
    id,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

/**
 * Best-effort metadata (title, channel) from YouTube's public oEmbed
 * endpoint. Always resolves: a timeout, a private video or any network
 * error returns null and the form simply keeps what the organization
 * typed.
 */
export async function fetchYouTubeMeta(watchUrl: string): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown; author_name?: unknown };
    if (typeof data.title !== "string") return null;
    return { title: data.title, channel: typeof data.author_name === "string" ? data.author_name : "" };
  } catch {
    return null;
  }
}
