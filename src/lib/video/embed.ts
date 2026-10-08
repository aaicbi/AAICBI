/**
 * How course videos are embedded. Everything stays inside the platform:
 * an iframe on the YouTube privacy host (youtube-nocookie.com) or Drive's
 * preview player, never a link out to youtube.com.
 *
 * `playsinline=1` is what stops iPhone Safari from throwing the video into
 * its own full-screen player the moment it starts; `rel=0` keeps the end
 * screen to the same channel; `modestbranding=1` hides the YouTube logo
 * link in the control bar (the thing that opens the YouTube app on phones).
 * Full screen is still offered by the player's own button (`fs=1`), which
 * is the one fullscreen path every phone browser supports.
 */
export type VideoSource = { kind: "youtube"; id: string } | { kind: "drive"; id: string };

export function embedSrc(source: VideoSource, opts: { autoplay?: boolean } = {}): string {
  const autoplay = opts.autoplay ? "1" : "0";
  if (source.kind === "youtube") {
    const q = new URLSearchParams({ autoplay, playsinline: "1", rel: "0", modestbranding: "1", fs: "1", iv_load_policy: "3" });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(source.id)}?${q.toString()}`;
  }
  return `https://drive.google.com/file/d/${encodeURIComponent(source.id)}/preview`;
}

/** Permissions the player frame needs: autoplay after the tap, picture-in-picture, and full screen. */
export const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture";

export function posterUrl(source: VideoSource): string | null {
  return source.kind === "youtube" ? `https://i.ytimg.com/vi/${encodeURIComponent(source.id)}/hqdefault.jpg` : `https://drive.google.com/thumbnail?id=${encodeURIComponent(source.id)}&sz=w1280`;
}
