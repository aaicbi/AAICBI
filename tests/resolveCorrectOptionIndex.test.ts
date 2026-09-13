import { describe, it, expect } from "vitest";
import { resolveCorrectOptionIndex } from "@/lib/ai/extractQuestions";

describe("resolveCorrectOptionIndex", () => {
  it("passes through a valid 0-indexed value unchanged", () => {
    expect(resolveCorrectOptionIndex(0, 4)).toEqual({ index: 0, wasCorrected: false });
    expect(resolveCorrectOptionIndex(3, 4)).toEqual({ index: 3, wasCorrected: false });
  });

  it("passes through null unchanged", () => {
    expect(resolveCorrectOptionIndex(null, 4)).toEqual({ index: null, wasCorrected: false });
  });

  // The actual bug: a real import came back with every question
  // "confident" and a non-null index, but the index never matched any
  // real option — every single one was out of range for a 4-option
  // array (i.e. 4 or higher), consistent with the model treating the
  // index as 1-indexed. Only an out-of-range value can be corrected
  // this way — an in-range value (like 1, meaning "B") is genuinely
  // ambiguous with a real 0-indexed answer and is deliberately left
  // alone, since there's no way to tell those two cases apart.
  it("corrects a 1-indexed value that's out of range as 0-indexed", () => {
    expect(resolveCorrectOptionIndex(4, 4)).toEqual({ index: 3, wasCorrected: true });
  });

  it("leaves an in-range index alone even though it could theoretically be a 1-indexed value", () => {
    expect(resolveCorrectOptionIndex(1, 4)).toEqual({ index: 1, wasCorrected: false });
  });

  it("falls back to null when the index is out of range even as 1-indexed", () => {
    expect(resolveCorrectOptionIndex(5, 4)).toEqual({ index: null, wasCorrected: true });
    expect(resolveCorrectOptionIndex(-1, 4)).toEqual({ index: null, wasCorrected: true });
  });
});
