import { describe, it, expect } from "vitest";
import { validateAssignmentQuestions, hasBlockingIssues, type ValidatableQuestion } from "../src/lib/assignmentValidation";

function question(overrides: Partial<ValidatableQuestion> = {}): ValidatableQuestion {
  return {
    questionNumber: "1",
    maxMarks: 10,
    expectedAnswer: "A good answer.",
    expectedConcepts: null,
    rubric: null,
    needsReview: false,
    reviewReason: null,
    ...overrides,
  };
}

describe("validateAssignmentQuestions", () => {
  it("produces no issues for a fully specified question", () => {
    const issues = validateAssignmentQuestions([question()]);
    expect(issues).toEqual([]);
  });

  it("flags a missing mark allocation as a blocker", () => {
    const issues = validateAssignmentQuestions([question({ maxMarks: null })]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("blocker");
    expect(issues[0].message).toContain("no mark allocation");
  });

  it("flags zero or negative marks as a blocker too", () => {
    expect(validateAssignmentQuestions([question({ maxMarks: 0 })])[0].severity).toBe("blocker");
  });

  it("flags a missing expected answer AND missing expected concepts as a warning, not a blocker", () => {
    const issues = validateAssignmentQuestions([question({ expectedAnswer: null, expectedConcepts: null })]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("does not warn when expectedConcepts is present even without an expectedAnswer", () => {
    const issues = validateAssignmentQuestions([question({ expectedAnswer: null, expectedConcepts: ["missing data", "accuracy"] })]);
    expect(issues).toEqual([]);
  });

  it("warns when rubric criteria don't sum to the question's total marks", () => {
    const issues = validateAssignmentQuestions([
      question({ maxMarks: 10, rubric: [{ name: "Understanding", maxMarks: 3 }, { name: "Accuracy", maxMarks: 3 }] }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("add up to 6");
  });

  it("does not warn when rubric criteria sum correctly", () => {
    const issues = validateAssignmentQuestions([
      question({ maxMarks: 10, rubric: [{ name: "Understanding", maxMarks: 5 }, { name: "Accuracy", maxMarks: 5 }] }),
    ]);
    expect(issues).toEqual([]);
  });

  it("surfaces a needsReview flag from import as its own warning", () => {
    const issues = validateAssignmentQuestions([question({ needsReview: true, reviewReason: "AI could not confidently extract this question." })]);
    expect(issues.some((i) => i.message.includes("AI could not confidently extract"))).toBe(true);
  });

  it("hasBlockingIssues is true only when at least one blocker exists", () => {
    expect(hasBlockingIssues([{ questionNumber: "1", severity: "warning", message: "x" }])).toBe(false);
    expect(hasBlockingIssues([{ questionNumber: "1", severity: "blocker", message: "x" }])).toBe(true);
    expect(hasBlockingIssues([])).toBe(false);
  });
});
