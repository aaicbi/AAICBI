/**
 * Where a picture sits inside the frame it will be shown in. The person drags the picture and zooms; this works out which part
 * of the original is kept. No browser or database here, so it can be tested.
 *
 * Zoom 1 is the smallest picture that still fills the frame (the "cover" fit). More than 1 is closer in. Less than 1 shows the
 * whole picture with empty space around it (for logos that must not be cut).
 */
export interface Crop { x: number; y: number; w: number; h: number }
export interface FrameState { zoom: number; /** centre of the frame, in the picture's own pixels */ cx: number; cy: number }

/** The organization cover is a wide strip: 5 to 1 on a computer and 3 to 1 on a phone. The public page, the preview and the picture editor all use these, so what is placed is what is seen. */
export const COVER_ASPECT = 5;
export const COVER_PHONE_ASPECT = 3;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The part of the original that fills the frame at zoom 1. */
export function coverSize(imgW: number, imgH: number, aspect: number): { w: number; h: number } {
  const w = Math.min(imgW, imgH * aspect);
  return { w, h: w / aspect };
}

export function startState(imgW: number, imgH: number): FrameState {
  return { zoom: 1, cx: imgW / 2, cy: imgH / 2 };
}

/** The kept part of the picture. When it is larger than the picture on one side, that side is centred (empty space around). */
export function cropRect(imgW: number, imgH: number, aspect: number, s: FrameState): Crop {
  const base = coverSize(imgW, imgH, aspect);
  const zoom = clamp(s.zoom, MIN_ZOOM, MAX_ZOOM);
  const w = base.w / zoom;
  const h = w / aspect;
  const x = w >= imgW ? (imgW - w) / 2 : clamp(s.cx - w / 2, 0, imgW - w);
  const y = h >= imgH ? (imgH - h) / 2 : clamp(s.cy - h / 2, 0, imgH - h);
  return { x, y, w, h };
}

/** Dragging the picture by (dx, dy) on screen, where the frame is `framePxW` wide on screen. */
export function panBy(imgW: number, imgH: number, aspect: number, s: FrameState, dx: number, dy: number, framePxW: number): FrameState {
  const c = cropRect(imgW, imgH, aspect, s);
  const per = c.w / framePxW; // picture pixels per screen pixel
  const next = { ...s, cx: c.x + c.w / 2 - dx * per, cy: c.y + c.h / 2 - dy * per };
  const r = cropRect(imgW, imgH, aspect, next);
  return { ...next, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/** Zooming keeps the centre of the frame where it is. */
export function zoomTo(imgW: number, imgH: number, aspect: number, s: FrameState, zoom: number): FrameState {
  const c = cropRect(imgW, imgH, aspect, s);
  const next = { zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM), cx: c.x + c.w / 2, cy: c.y + c.h / 2 };
  const r = cropRect(imgW, imgH, aspect, next);
  return { ...next, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/** True when the kept part reaches outside the picture, so the result needs transparent space (and so must be a PNG). */
export function needsPadding(imgW: number, imgH: number, c: Crop): boolean {
  return c.w > imgW + 0.5 || c.h > imgH + 0.5;
}

/** The size to save at: the frame's shape, not larger than the picture itself allows, and never huge. */
export function outputSize(aspect: number, c: Crop, maxWidth = 1600): { w: number; h: number } {
  const w = Math.max(1, Math.round(Math.min(c.w, maxWidth)));
  return { w, h: Math.max(1, Math.round(w / aspect)) };
}

/** What a narrower box shows of a picture that was kept for a wider one: the middle of it, full height (the way `object-fit: cover` cuts it). */
export function narrowerView(c: Crop, narrowAspect: number): Crop {
  const w = Math.min(c.w, c.h * narrowAspect);
  const h = w / narrowAspect;
  return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h };
}
