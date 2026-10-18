import { describe, it, expect } from "vitest";
import { ratingDelta, expectedScore, tierOf, progressToNext, weekStart, monthStart, K_FACTOR, START_RATING } from "@/lib/arena/ladderCore";

describe("champion ladder rating", () => {
  it("an even match moves about half of K either way", () => {
    expect(ratingDelta(1000, 1000, 1)).toBe(16);
    expect(ratingDelta(1000, 1000, 0)).toBe(-16);
    expect(ratingDelta(1000, 1000, 0.5)).toBe(0);
  });
  it("beating a stronger player is worth more than beating a weaker one", () => {
    expect(ratingDelta(1000, 1400, 1)).toBeGreaterThan(ratingDelta(1000, 1000, 1));
    expect(ratingDelta(1400, 1000, 1)).toBeLessThan(ratingDelta(1000, 1000, 1));
  });
  it("losing to a stronger player costs less", () => {
    expect(ratingDelta(1000, 1400, 0)).toBeGreaterThan(ratingDelta(1000, 1000, 0));
  });
  it("never moves a player by more than K, and the two sides roughly cancel", () => {
    for (const [a, b] of [[800, 1800], [1800, 800], [1000, 1000]]) {
      expect(Math.abs(ratingDelta(a, b, 1))).toBeLessThanOrEqual(K_FACTOR);
      expect(Math.abs(ratingDelta(a, b, 0))).toBeLessThanOrEqual(K_FACTOR);
      expect(Math.abs(ratingDelta(a, b, 1) + ratingDelta(b, a, 0))).toBeLessThanOrEqual(1);
    }
  });
  it("expected score is a probability", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.9);
  });
});

describe("tiers", () => {
  it("places ratings in the agreed tiers", () => {
    expect(START_RATING).toBe(1000);
    expect(tierOf(999).tier).toBe("BRONZE");
    expect(tierOf(1000).tier).toBe("SILVER");
    expect(tierOf(1262).tier).toBe("GOLD");
    expect(tierOf(1400).tier).toBe("PLATINUM");
    expect(tierOf(1600).tier).toBe("CHAMPION");
  });
  it("says how far to the next tier", () => {
    expect(progressToNext(1262)).toMatchObject({ next: "Platinum", toNext: 138 });
    expect(progressToNext(1262)!.fraction).toBeCloseTo(0.31, 1);
    expect(progressToNext(1700)).toBeNull();
  });
});

describe("weeks and months", () => {
  it("a week starts on Monday at midnight UTC", () => {
    expect(weekStart(Date.UTC(2026, 10, 18, 15)).toISOString()).toBe("2026-11-16T00:00:00.000Z"); // a Wednesday
    expect(weekStart(Date.UTC(2026, 10, 15, 23)).toISOString()).toBe("2026-11-09T00:00:00.000Z"); // a Sunday belongs to the week before
    expect(weekStart(Date.UTC(2026, 10, 16)).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
  it("a month starts on the first", () => {
    expect(monthStart(Date.UTC(2026, 10, 18)).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});
