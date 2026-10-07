import { describe, it, expect } from "vitest";
import { buildReadiness, tally } from "@/lib/trainee/progressSurface";

describe("tally", () => {
  it("counts a topic once per attempt, ignoring case, most frequent first", () => {
    const result = tally([["Joins", "Indexes"], ["joins", "joins", "Views"], ["JOINS"]], 5);
    expect(result[0]).toEqual({ topic: "Joins", count: 3 });
    expect(result.map((r) => r.topic)).toEqual(["Joins", "Indexes", "Views"]);
  });

  it("respects the limit", () => {
    expect(tally([["a", "b", "c", "d"]], 2)).toHaveLength(2);
  });

  it("returns nothing for no attempts", () => {
    expect(tally([], 5)).toEqual([]);
  });
});

describe("buildReadiness", () => {
  it("is empty with no scores", () => {
    expect(buildReadiness([])).toEqual({ attemptsAnalysed: 0, averageScore: null, latestScore: null, scoreDelta: null });
  });

  it("has no delta for a single attempt", () => {
    expect(buildReadiness([72])).toMatchObject({ attemptsAnalysed: 1, averageScore: 72, latestScore: 72, scoreDelta: null });
  });

  it("compares the newest score with the ones before it", () => {
    // newest first: 80 now, earlier 60 and 70 (average 65)
    expect(buildReadiness([80, 60, 70])).toMatchObject({ latestScore: 80, scoreDelta: 15 });
  });

  it("averages only the five most recent attempts", () => {
    expect(buildReadiness([100, 100, 100, 100, 100, 0]).averageScore).toBe(100);
  });
});
