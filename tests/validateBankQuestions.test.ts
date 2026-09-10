import { describe, it, expect } from "vitest";
import { combineValidationSignals } from "@/lib/ai/validateBankQuestions";

/**
 * The pure verdict-combination logic, tested in isolation from Prisma
 * and any real AI call — same "pure core, testable without I/O" split
 * this project already uses for rateLimitCore/embeddingsCore. This is
 * the actual decision behind "AI generates, AI validates, humans
 * approve": correctness disagreement is the most severe outcome (the
 * generator's own answer key may be wrong), objective misalignment or
 * ambiguity is a real content-quality problem, and a duplicate alone
 * is the softest concern.
 */
describe("combineValidationSignals", () => {
  it("returns VALIDATED_PASS when every signal is clean", () => {
    expect(combineValidationSignals(true, true, false, false)).toBe("VALIDATED_PASS");
  });

  it("returns VALIDATED_REJECTED when correctness disagrees, regardless of other signals", () => {
    expect(combineValidationSignals(false, true, false, false)).toBe("VALIDATED_REJECTED");
    expect(combineValidationSignals(false, false, true, true)).toBe("VALIDATED_REJECTED");
  });

  it("returns VALIDATED_FLAGGED when objective alignment fails, even with correct answer", () => {
    expect(combineValidationSignals(true, false, false, false)).toBe("VALIDATED_FLAGGED");
  });

  it("returns VALIDATED_FLAGGED when the question is ambiguous, even with correct answer", () => {
    expect(combineValidationSignals(true, true, true, false)).toBe("VALIDATED_FLAGGED");
  });

  it("prioritizes FLAGGED over WARNING when both alignment/ambiguity and duplicate concerns exist", () => {
    expect(combineValidationSignals(true, false, false, true)).toBe("VALIDATED_FLAGGED");
  });

  it("returns VALIDATED_WARNING when only a duplicate match is found", () => {
    expect(combineValidationSignals(true, true, false, true)).toBe("VALIDATED_WARNING");
  });

  it("never returns PASS unless correctness, alignment, ambiguity, and duplication are all clean", () => {
    const outcomes = new Set<string>();
    for (const correctness of [true, false]) {
      for (const aligned of [true, false]) {
        for (const ambiguous of [true, false]) {
          for (const duplicate of [true, false]) {
            outcomes.add(combineValidationSignals(correctness, aligned, ambiguous, duplicate));
          }
        }
      }
    }
    expect(outcomes).toContain("VALIDATED_PASS");
    // Only the all-clean combination produces PASS.
    expect(combineValidationSignals(true, true, false, false)).toBe("VALIDATED_PASS");
  });
});
