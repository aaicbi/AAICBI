import { describe, expect, it } from "vitest";
import { improvementTips, percent, periodStart } from "@/lib/ecosystem/insightsCore";

describe("percent", () => {
  it("is null when there is nothing to divide by", () => {
    expect(percent(0, 0)).toBeNull();
    expect(percent(3, 0)).toBeNull();
  });
  it("rounds and never exceeds 100", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(9, 3)).toBe(100);
  });
});

describe("improvementTips", () => {
  const strong = { quality: 1, engagement: 1, consistency: 1, participation: 1, achievements: 1, programs: 1 };
  it("has nothing to say when everything is strong", () => {
    expect(improvementTips(strong)).toEqual([]);
  });
  it("lists the weakest first and caps the list", () => {
    const tips = improvementTips({ ...strong, consistency: 0.1, achievements: 0.3, programs: 0.5, quality: 0.6 });
    expect(tips.map((t) => t.component)).toEqual(["consistency", "achievements", "programs"]);
  });
});

describe("periodStart", () => {
  it("goes back whole days", () => {
    expect(periodStart(30, new Date("2026-10-31T00:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
