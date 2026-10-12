import { describe, it, expect } from "vitest";
import { coverSize, startState, cropRect, panBy, zoomTo, needsPadding, outputSize, narrowerView, COVER_ASPECT, COVER_PHONE_ASPECT } from "@/lib/imageFrame";

const W = 4000, H = 3000; // a wide photo
describe("image frame", () => {
  it("starts centred and filling a wide frame", () => {
    const c = cropRect(W, H, 16 / 5, startState(W, H));
    expect(c.w).toBe(4000);
    expect(Math.round(c.h)).toBe(1250);
    expect(c.x).toBe(0);
    expect(Math.round(c.y + c.h / 2)).toBe(1500);
  });
  it("fills a square frame from a wide photo", () => {
    expect(coverSize(W, H, 1)).toEqual({ w: 3000, h: 3000 });
  });
  it("dragging moves the picture the other way and stops at the edge", () => {
    const s = startState(W, H);
    const down = panBy(W, H, 16 / 5, s, 0, 100, 800); // drag the picture down: show a higher part
    expect(down.cy).toBeLessThan(s.cy);
    const far = panBy(W, H, 16 / 5, s, 0, 100000, 800);
    expect(cropRect(W, H, 16 / 5, far).y).toBe(0);
    const far2 = panBy(W, H, 16 / 5, s, 0, -100000, 800);
    const c2 = cropRect(W, H, 16 / 5, far2);
    expect(Math.round(c2.y + c2.h)).toBe(H);
  });
  it("zooming in keeps the centre and shrinks the kept part", () => {
    const s = startState(W, H);
    const z = zoomTo(W, H, 1, s, 2);
    const c = cropRect(W, H, 1, z);
    expect(c.w).toBe(1500);
    expect(Math.round(c.x + c.w / 2)).toBe(2000);
  });
  it("zooming out below the picture asks for padding, and never beyond the limits", () => {
    const z = zoomTo(W, H, 1, startState(W, H), 0.5);
    const c = cropRect(W, H, 1, z);
    expect(needsPadding(W, H, c)).toBe(true);
    expect(zoomTo(W, H, 1, startState(W, H), 0.01).zoom).toBe(0.5);
    expect(zoomTo(W, H, 1, startState(W, H), 99).zoom).toBe(4);
    expect(needsPadding(W, H, cropRect(W, H, 1, startState(W, H)))).toBe(false);
  });
  it("saves at the frame's shape and never huge", () => {
    const c = cropRect(W, H, 16 / 5, startState(W, H));
    const o = outputSize(16 / 5, c);
    expect(o.w).toBe(1600);
    expect(o.h).toBe(500);
  });
  it("a phone sees the middle of the wide cover, full height", () => {
    const c = cropRect(W, H, COVER_ASPECT, startState(W, H)); // 5 to 1
    const v = narrowerView(c, COVER_PHONE_ASPECT); // 3 to 1
    expect(v.h).toBeCloseTo(c.h);
    expect(v.w).toBeCloseTo(c.h * 3);
    expect(v.x + v.w / 2).toBeCloseTo(c.x + c.w / 2);
    expect(v.y).toBeCloseTo(c.y);
  });
  it("a box as wide as the cover shows all of it", () => {
    const c = cropRect(W, H, COVER_ASPECT, startState(W, H));
    expect(narrowerView(c, COVER_ASPECT)).toEqual(c);
  });
});
