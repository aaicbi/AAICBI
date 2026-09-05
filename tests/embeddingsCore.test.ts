import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  isDuplicateMatch,
  findClosestDuplicate,
  DUPLICATE_SIMILARITY_THRESHOLD,
} from "@/lib/embeddingsCore";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it("is symmetric", () => {
    const a = [0.1, 0.5, -0.3, 0.9];
    const b = [0.4, -0.2, 0.1, 0.6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it("throws on mismatched lengths rather than silently comparing a prefix", () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow();
  });

  it("returns 0 rather than NaN for a zero vector", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe("isDuplicateMatch", () => {
  it("flags similarity at or above the threshold", () => {
    expect(isDuplicateMatch(DUPLICATE_SIMILARITY_THRESHOLD)).toBe(true);
    expect(isDuplicateMatch(0.99)).toBe(true);
  });

  it("does not flag similarity below the threshold", () => {
    expect(isDuplicateMatch(DUPLICATE_SIMILARITY_THRESHOLD - 0.01)).toBe(false);
    expect(isDuplicateMatch(0.5)).toBe(false);
  });
});

describe("findClosestDuplicate", () => {
  it("returns null for an empty candidate list", () => {
    expect(findClosestDuplicate([])).toBeNull();
  });

  it("returns null when nothing crosses the threshold", () => {
    const candidates = [
      { item: "a", similarity: 0.5 },
      { item: "b", similarity: 0.8 },
    ];
    expect(findClosestDuplicate(candidates)).toBeNull();
  });

  it("returns the single match that crosses the threshold", () => {
    const candidates = [
      { item: "a", similarity: 0.5 },
      { item: "b", similarity: 0.97 },
    ];
    expect(findClosestDuplicate(candidates)).toEqual({ item: "b", similarity: 0.97 });
  });

  it("returns the highest-similarity match when multiple cross the threshold", () => {
    const candidates = [
      { item: "a", similarity: 0.94 },
      { item: "b", similarity: 0.99 },
      { item: "c", similarity: 0.95 },
    ];
    expect(findClosestDuplicate(candidates)).toEqual({ item: "b", similarity: 0.99 });
  });
});
