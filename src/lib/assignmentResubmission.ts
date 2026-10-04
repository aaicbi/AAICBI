/**
 * AI Assignment Engine, Phase 2 — the pure decision behind
 * `resubmissionScope: FAILED_QUESTIONS_ONLY` (§18): given the previous
 * attempt's answers and the assignment's own instructor-set threshold,
 * decide which questions carry their answer/score forward unchanged
 * versus which are reopened blank. Extracted here, no Prisma import, so
 * the actual selection rule is unit-testable without a database.
 */
export interface PreviousAnswerForCarryForward {
  questionId: string;
  answerText: string | null;
  maxMarks: number;
  aiScore: number | null;
  instructorScore: number | null;
}

export interface CarryForwardDecision {
  questionId: string;
  carryForward: boolean;
  finalPercentage: number | null;
}

/**
 * A question with no score at all yet (still ungraded — e.g. a prior
 * attempt that was never actually assessed) is treated as NOT passing
 * the threshold — reopened for resubmission, never silently carried
 * forward with no real grade behind it.
 */
export function decideCarryForward(
  answers: PreviousAnswerForCarryForward[],
  thresholdPercent: number
): CarryForwardDecision[] {
  return answers.map((a) => {
    const finalScore = a.instructorScore ?? a.aiScore;
    if (finalScore === null || a.maxMarks <= 0) {
      return { questionId: a.questionId, carryForward: false, finalPercentage: null };
    }
    const percentage = (finalScore / a.maxMarks) * 100;
    return { questionId: a.questionId, carryForward: percentage >= thresholdPercent, finalPercentage: percentage };
  });
}
