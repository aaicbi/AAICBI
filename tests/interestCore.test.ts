import { describe, it, expect } from "vitest";
import { computeDecayedWeight, computeConfidencePercent, classifyInterests } from "../src/lib/analytics/interestCore";

describe("computeDecayedWeight", () => {
  it("returns the full raw weight for an event today", () => {
    expect(computeDecayedWeight(10, 0, 60)).toBe(10);
  });

  it("halves the weight after exactly one half-life", () => {
    expect(computeDecayedWeight(10, 60, 60)).toBeCloseTo(5, 5);
  });

  it("quarters the weight after two half-lives", () => {
    expect(computeDecayedWeight(10, 120, 60)).toBeCloseTo(2.5, 5);
  });

  it("never reaches exactly zero, however old — it just keeps fading", () => {
    expect(computeDecayedWeight(10, 3650, 60)).toBeGreaterThan(0);
  });
});

describe("computeConfidencePercent", () => {
  it("returns 0 for no evidence at all", () => {
    expect(computeConfidencePercent(0, 20)).toBe(0);
    expect(computeConfidencePercent(-5, 20)).toBe(0);
  });

  it("climbs as evidence accumulates, but never reaches 100", () => {
    const low = computeConfidencePercent(5, 20);
    const high = computeConfidencePercent(50, 20);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(100);
  });

  it("approaches but doesn't exceed 100 even for a large, realistic score", () => {
    const result = computeConfidencePercent(200, 20);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThan(99);
  });
});

describe("classifyInterests", () => {
  it("returns null primary and empty arrays when there are no topics", () => {
    expect(classifyInterests([])).toEqual({ primary: null, secondary: [], emerging: [] });
  });

  it("picks the highest-confidence topic as primary", () => {
    const result = classifyInterests([
      { topic: "Cybersecurity", confidencePercent: 87, allEvidenceRecent: false },
      { topic: "Data Analytics", confidencePercent: 62, allEvidenceRecent: false },
    ]);
    expect(result.primary).toBe("Cybersecurity");
  });

  it("includes up to two secondary topics above the minimum confidence floor", () => {
    const result = classifyInterests([
      { topic: "A", confidencePercent: 90, allEvidenceRecent: false },
      { topic: "B", confidencePercent: 50, allEvidenceRecent: false },
      { topic: "C", confidencePercent: 30, allEvidenceRecent: false },
      { topic: "D", confidencePercent: 20, allEvidenceRecent: false },
      { topic: "E", confidencePercent: 2, allEvidenceRecent: false }, // below the floor
    ]);
    expect(result.primary).toBe("A");
    expect(result.secondary).toEqual(["B", "C"]);
    expect(result.secondary).not.toContain("E");
  });

  it("classifies a topic with only recent evidence as emerging, not primary, when a stronger topic exists", () => {
    const result = classifyInterests([
      { topic: "AI Engineering", confidencePercent: 80, allEvidenceRecent: false },
      { topic: "Cybersecurity", confidencePercent: 10, allEvidenceRecent: true },
    ]);
    expect(result.primary).toBe("AI Engineering");
    expect(result.emerging).toEqual(["Cybersecurity"]);
  });

  it("never double-lists a topic as both secondary and emerging", () => {
    const result = classifyInterests([
      { topic: "A", confidencePercent: 90, allEvidenceRecent: true },
      { topic: "B", confidencePercent: 50, allEvidenceRecent: true },
    ]);
    expect(result.primary).toBe("A");
    expect(result.secondary).toEqual(["B"]);
    expect(result.emerging).not.toContain("A");
    expect(result.emerging).not.toContain("B");
  });

  it("never labels a single weak, below-floor signal as Primary Interest", () => {
    // Regression test for a real bug found while verifying Phase 3
    // against the real database: a trainee with just one course view
    // (~5% confidence) was being reported as having a "Primary
    // Interest" purely for being the only topic with any score at all.
    const result = classifyInterests([{ topic: "AI Engineering", confidencePercent: 5, allEvidenceRecent: true }]);
    expect(result.primary).toBeNull();
    expect(result.secondary).toEqual([]);
    expect(result.emerging).toEqual(["AI Engineering"]);
  });

  it("a weak below-floor signal that is NOT recent appears nowhere at all", () => {
    const result = classifyInterests([{ topic: "AI Engineering", confidencePercent: 5, allEvidenceRecent: false }]);
    expect(result.primary).toBeNull();
    expect(result.secondary).toEqual([]);
    expect(result.emerging).toEqual([]);
  });

  it("ignores topics with zero or negative confidence entirely", () => {
    const result = classifyInterests([
      { topic: "A", confidencePercent: 0, allEvidenceRecent: false },
      { topic: "B", confidencePercent: 40, allEvidenceRecent: false },
    ]);
    expect(result.primary).toBe("B");
    expect(result.secondary).not.toContain("A");
    expect(result.emerging).not.toContain("A");
  });
});
