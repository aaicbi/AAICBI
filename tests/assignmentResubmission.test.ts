import { describe, it, expect } from "vitest";
import { decideCarryForward, type PreviousAnswerForCarryForward } from "../src/lib/assignmentResubmission";

describe("decideCarryForward", () => {
  it("carries forward a question scoring at or above the threshold", () => {
    const answers: PreviousAnswerForCarryForward[] = [{ questionId: "q1", answerText: "x", maxMarks: 10, aiScore: 5, instructorScore: null }];
    const result = decideCarryForward(answers, 50);
    expect(result[0].carryForward).toBe(true); // exactly 50%, boundary included
  });

  it("reopens a question scoring below the threshold", () => {
    const answers: PreviousAnswerForCarryForward[] = [{ questionId: "q1", answerText: "x", maxMarks: 10, aiScore: 4, instructorScore: null }];
    const result = decideCarryForward(answers, 50);
    expect(result[0].carryForward).toBe(false);
    expect(result[0].finalPercentage).toBe(40);
  });

  it("prefers the instructor's override score over the AI score when both exist", () => {
    const answers: PreviousAnswerForCarryForward[] = [{ questionId: "q1", answerText: "x", maxMarks: 10, aiScore: 3, instructorScore: 8 }];
    const result = decideCarryForward(answers, 50);
    expect(result[0].carryForward).toBe(true); // 80% from the instructor override, not 30% from AI
  });

  it("reopens a question with no score at all, never carrying forward an ungraded answer", () => {
    const answers: PreviousAnswerForCarryForward[] = [{ questionId: "q1", answerText: "x", maxMarks: 10, aiScore: null, instructorScore: null }];
    const result = decideCarryForward(answers, 50);
    expect(result[0].carryForward).toBe(false);
    expect(result[0].finalPercentage).toBeNull();
  });

  it("handles multiple questions independently", () => {
    const answers: PreviousAnswerForCarryForward[] = [
      { questionId: "q1", answerText: "good", maxMarks: 10, aiScore: 9, instructorScore: null },
      { questionId: "q2", answerText: "bad", maxMarks: 10, aiScore: 2, instructorScore: null },
    ];
    const result = decideCarryForward(answers, 50);
    expect(result.find((r) => r.questionId === "q1")!.carryForward).toBe(true);
    expect(result.find((r) => r.questionId === "q2")!.carryForward).toBe(false);
  });
});
