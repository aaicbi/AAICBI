import { describe, it, expect } from "vitest";
import { pickActive, progressFraction, MIN_VISIBLE } from "@/lib/video/activeVideo";
import { playerVars } from "@/lib/video/embed";

const c = (key: string, ratio: number, distance = 0) => ({ key, ratio, distance });

describe("which video plays", () => {
  it("nothing plays when no video is mostly on screen", () => {
    expect(pickActive([c("a", 0.2), c("b", MIN_VISIBLE - 0.01)], null)).toBeNull();
    expect(pickActive([], null)).toBeNull();
  });
  it("the video most on screen plays", () => {
    expect(pickActive([c("a", 0.6), c("b", 1)], null)).toBe("b");
  });
  it("when two are equally in view, the one nearer the middle plays", () => {
    expect(pickActive([c("a", 1, 300), c("b", 1, 40)], null)).toBe("b");
  });
  it("the video already playing keeps going until another is clearly more in view", () => {
    expect(pickActive([c("a", 0.8), c("b", 0.9)], "a")).toBe("a");
    expect(pickActive([c("a", 0.6), c("b", 1)], "a")).toBe("b");
  });
  it("when the playing video scrolls out, it stops and the next one takes over", () => {
    expect(pickActive([c("a", 0.3), c("b", 0.9)], "a")).toBe("b");
    expect(pickActive([c("a", 0.3), c("b", 0.4)], "a")).toBeNull();
  });
});

describe("progress", () => {
  it("is a fraction, and 0 until the length is known", () => {
    expect(progressFraction(30, 120)).toBe(0.25);
    expect(progressFraction(5, 0)).toBe(0);
    expect(progressFraction(NaN, 100)).toBe(0);
    expect(progressFraction(200, 100)).toBe(1);
  });
});

describe("player settings", () => {
  it("switches off the player's own controls and keeps it inline", () => {
    const v = playerVars({ autoplay: true, mute: true });
    expect(v).toMatchObject({ controls: 0, fs: 0, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, mute: 1, autoplay: 1, enablejsapi: 1 });
    expect(playerVars({ autoplay: false, mute: false })).toMatchObject({ autoplay: 0, mute: 0 });
  });
});
