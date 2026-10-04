/**
 * AI Assignment Engine — document validation before publish (spec
 * §22). Pure and synchronous, same testable discipline as every other
 * real decision function in this project (coursePricing.ts,
 * courseSchedule.ts). Deliberately returns issues rather than
 * throwing — the admin review screen needs the WHOLE list at once
 * ("10 questions detected... Question 4 has no expected answer...
 * Question 7 has no mark allocation..."), not a fail-fast single error.
 *
 * Only a missing mark allocation is a hard blocker — unambiguous,
 * every question needs one to ever be scored at all. A missing
 * expected answer or rubric is a warning, not a blocker: a REFLECTION
 * or an open-ended ESSAY question can legitimately have neither, and
 * refusing to publish those would be wrong, not safe.
 */
export interface AssignmentValidationIssue {
  questionNumber: string;
  severity: "blocker" | "warning";
  message: string;
}

export interface ValidatableQuestion {
  questionNumber: string;
  maxMarks: number | null;
  expectedAnswer: string | null;
  expectedConcepts: unknown;
  rubric: unknown;
  needsReview: boolean;
  reviewReason: string | null;
}

export function validateAssignmentQuestions(questions: ValidatableQuestion[]): AssignmentValidationIssue[] {
  const issues: AssignmentValidationIssue[] = [];

  for (const q of questions) {
    if (q.maxMarks === null || q.maxMarks === undefined || q.maxMarks <= 0) {
      issues.push({
        questionNumber: q.questionNumber,
        severity: "blocker",
        message: `Question ${q.questionNumber} has no mark allocation.`,
      });
    }

    const hasExpectedAnswer = !!q.expectedAnswer?.trim();
    const hasExpectedConcepts = Array.isArray(q.expectedConcepts) && q.expectedConcepts.length > 0;
    if (!hasExpectedAnswer && !hasExpectedConcepts) {
      issues.push({
        questionNumber: q.questionNumber,
        severity: "warning",
        message: `Question ${q.questionNumber} has no expected answer or expected concepts — AI assessment will grade this one holistically against the question text alone.`,
      });
    }

    if (Array.isArray(q.rubric) && q.rubric.length > 0) {
      const rubricTotal = q.rubric.reduce((sum: number, c: unknown) => {
        const criterion = c as { maxMarks?: number };
        return sum + (typeof criterion.maxMarks === "number" ? criterion.maxMarks : 0);
      }, 0);
      if (q.maxMarks !== null && rubricTotal !== q.maxMarks) {
        issues.push({
          questionNumber: q.questionNumber,
          severity: "warning",
          message: `Question ${q.questionNumber}'s rubric criteria add up to ${rubricTotal}, not its ${q.maxMarks} total marks — double-check the rubric before publishing.`,
        });
      }
    }

    if (q.needsReview) {
      issues.push({
        questionNumber: q.questionNumber,
        severity: "warning",
        message: `Question ${q.questionNumber} was flagged during import: ${q.reviewReason ?? "needs manual review."}`,
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: AssignmentValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "blocker");
}
