/**
 * AI Assignment Engine, Phase 2 — the pure half of assignment analytics
 * (§26/§27). Same split rationale as every other *Core.ts-style file
 * in this project (performanceCore.ts): no Prisma import, no AI call,
 * testable on its own. The admin analytics route does the one
 * `findMany` and hands the rows here.
 */

export interface SubmissionForAnalytics {
  attemptNumber: number;
  status: string;
  percentage: number | null;
}

export interface AssignmentOverallStats {
  assignedCount: number;
  startedCount: number;
  submittedCount: number;
  pendingReviewCount: number;
  averagePercentage: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  resubmissionRate: number; // 0-1, share of submissions that are a resubmission (attemptNumber > 1)
}

const PENDING_REVIEW_STATUSES = new Set(["SUBMITTED", "ASSESSMENT_PENDING", "MANUAL_PENDING"]);
const SUBMITTED_OR_LATER_STATUSES = new Set([
  "SUBMITTED", "ASSESSMENT_PENDING", "AI_ASSESSED", "MANUAL_PENDING", "INSTRUCTOR_REVIEWED", "RETURNED", "RESUBMISSION_REQUIRED", "COMPLETED",
]);

/**
 * `assignedCount` is passed in rather than computed here — it comes
 * from a live course-enrollment count, a genuinely different query
 * than the submissions this function otherwise works from.
 */
export function computeAssignmentOverallStats(
  submissions: SubmissionForAnalytics[],
  assignedCount: number
): AssignmentOverallStats {
  const started = submissions.length;
  const submittedOrLater = submissions.filter((s) => SUBMITTED_OR_LATER_STATUSES.has(s.status));
  const pendingReview = submissions.filter((s) => PENDING_REVIEW_STATUSES.has(s.status));
  const scored = submissions.filter((s) => s.percentage !== null);
  const resubmissions = submissions.filter((s) => s.attemptNumber > 1);

  const percentages = scored.map((s) => s.percentage!);
  const average = percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : null;

  return {
    assignedCount,
    startedCount: started,
    submittedCount: submittedOrLater.length,
    pendingReviewCount: pendingReview.length,
    averagePercentage: average,
    highestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
    lowestPercentage: percentages.length > 0 ? Math.min(...percentages) : null,
    resubmissionRate: started > 0 ? resubmissions.length / started : 0,
  };
}

export interface AnswerForLearningObjectiveStats {
  learningObjective: string | null;
  score: number; // the final, graded percentage (0-100) for this answer
}

const UNTAGGED_OBJECTIVE_LABEL = "General";

/**
 * Groups a trainee's scored answers (across every assignment, not just
 * one) into per-learningObjective running totals, feeding
 * analyzeAssignmentLearningPatterns.ts (§20). Same "General" fallback
 * bucket convention as performanceCore.ts's own computeTopicStats, for
 * the same reason: a question with no learningObjective set shouldn't
 * have its score silently dropped from the trainee's overall picture.
 */
export function aggregateLearningObjectiveStats(
  answers: AnswerForLearningObjectiveStats[]
): { learningObjective: string; totalPercentage: number; count: number }[] {
  const byObjective = new Map<string, { totalPercentage: number; count: number }>();
  for (const a of answers) {
    const key = a.learningObjective?.trim() || UNTAGGED_OBJECTIVE_LABEL;
    const existing = byObjective.get(key) ?? { totalPercentage: 0, count: 0 };
    existing.totalPercentage += a.score;
    existing.count += 1;
    byObjective.set(key, existing);
  }
  return Array.from(byObjective.entries()).map(([learningObjective, stat]) => ({ learningObjective, ...stat }));
}

export interface AnswerForQuestionAnalytics {
  questionId: string;
  score: number | null; // the FINAL score (instructorScore ?? aiScore)
  maxMarks: number;
}

export interface QuestionStat {
  questionId: string;
  averagePercentage: number | null;
  answeredCorrectlyShare: number; // 0-1, share scoring >= 70%
  needsImprovementShare: number; // 0-1, share scoring < 70%
  gradedCount: number;
}

const CORRECT_THRESHOLD_PERCENT = 70;

/** One entry per distinct questionId present in `answers`. A question
 * with zero graded answers yet still appears, with null/0 stats, so
 * the analytics page can show "not yet assessed" rather than omitting
 * the question entirely. */
export function computeQuestionStats(answers: AnswerForQuestionAnalytics[], questionIds: string[]): QuestionStat[] {
  return questionIds.map((questionId) => {
    const forQuestion = answers.filter((a) => a.questionId === questionId && a.score !== null);
    if (forQuestion.length === 0) {
      return { questionId, averagePercentage: null, answeredCorrectlyShare: 0, needsImprovementShare: 0, gradedCount: 0 };
    }
    const percentages = forQuestion.map((a) => (a.maxMarks > 0 ? (a.score! / a.maxMarks) * 100 : 0));
    const correct = percentages.filter((p) => p >= CORRECT_THRESHOLD_PERCENT).length;
    return {
      questionId,
      averagePercentage: percentages.reduce((a, b) => a + b, 0) / percentages.length,
      answeredCorrectlyShare: correct / forQuestion.length,
      needsImprovementShare: (forQuestion.length - correct) / forQuestion.length,
      gradedCount: forQuestion.length,
    };
  });
}
