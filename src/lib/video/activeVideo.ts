/**
 * Which video on the page should be playing. No browser here, so it can be tested. Each video reports how much of it is on screen
 * (0 to 1) and how far its middle is from the middle of the screen. The one that is most on screen plays; the others pause. A video
 * must be mostly in view to start (so one only just appearing at the edge does not), and the one already playing keeps playing
 * until another is clearly more in view, so two videos on screen together do not keep swapping.
 */
export interface VideoCandidate { key: string; ratio: number; distance: number }

export const MIN_VISIBLE = 0.55;
/** How much more on screen another video must be before it takes over from the one already playing. */
export const TAKEOVER_MARGIN = 0.15;

export function pickActive(candidates: VideoCandidate[], current: string | null): string | null {
  const visible = candidates.filter((c) => c.ratio >= MIN_VISIBLE);
  if (visible.length === 0) return null;
  const best = [...visible].sort((a, b) => (Math.abs(b.ratio - a.ratio) < 0.05 ? a.distance - b.distance : b.ratio - a.ratio))[0];
  const keep = current ? visible.find((c) => c.key === current) : undefined;
  if (keep && keep.ratio >= best.ratio - TAKEOVER_MARGIN) return keep.key;
  return best.key;
}

/** 0 to 1, safe for a video whose length is not known yet. */
export function progressFraction(current: number, duration: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, current / duration));
}
