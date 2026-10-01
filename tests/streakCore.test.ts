import { describe, it, expect } from "vitest";
import { computeStreakDays } from "../src/lib/analytics/streakCore";

const NOW = new Date("2026-10-01T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("computeStreakDays", () => {
  it("returns 0 for no activity at all", () => {
    expect(computeStreakDays([], NOW)).toBe(0);
  });

  it("returns 0 when the most recent activity was more than a day ago", () => {
    expect(computeStreakDays([daysAgo(3)], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreakDays([daysAgo(0), daysAgo(1), daysAgo(2)], NOW)).toBe(3);
  });

  it("doesn't break the streak just because today has no activity yet", () => {
    expect(computeStreakDays([daysAgo(1), daysAgo(2), daysAgo(3)], NOW)).toBe(3);
  });

  it("stops counting at the first gap", () => {
    expect(computeStreakDays([daysAgo(0), daysAgo(1), daysAgo(3)], NOW)).toBe(2);
  });

  it("counts multiple same-day events as a single day", () => {
    const today = daysAgo(0);
    const laterToday = new Date(today.getTime() + 2 * 60 * 60 * 1000);
    expect(computeStreakDays([today, laterToday, daysAgo(1)], NOW)).toBe(2);
  });
});
