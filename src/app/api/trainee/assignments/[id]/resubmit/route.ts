import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { decideCarryForward } from "@/lib/assignmentResubmission";

/**
 * POST /api/trainee/assignments/[id]/resubmit — creates the next
 * attempt (§18), respecting the assignment's own resubmissionPolicy.
 *
 * When resubmissionScope is FULL_ASSIGNMENT, the new attempt starts
 * with the full assignment's worth of fresh, empty answers (Phase 1's
 * original, unchanged behavior). When it's FAILED_QUESTIONS_ONLY
 * (Phase 2), every question from the previous attempt scoring at or
 * above the assignment's own failedQuestionThresholdPercent carries
 * its answer AND score/feedback forward unchanged — a trainee never
 * loses a grade they already earned — while anything below it starts
 * genuinely blank, reopened for a fresh answer.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, resubmissionPolicy: true, maxResubmissions: true, resubmissionScope: true, failedQuestionThresholdPercent: true },
    });
    if (!assignment || assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (assignment.resubmissionPolicy === "NONE") {
      return NextResponse.json({ error: "This assignment doesn't allow resubmission." }, { status: 400 });
    }

    const latest = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: params.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
      include: { answers: true },
    });
    if (!latest) {
      return NextResponse.json({ error: "No existing submission to resubmit." }, { status: 400 });
    }
    if (latest.status === "IN_PROGRESS") {
      return NextResponse.json({ error: "Your current attempt isn't submitted yet — submit it first." }, { status: 400 });
    }

    const priorAttempts = latest.attemptNumber;
    const limit =
      assignment.resubmissionPolicy === "ONE" ? 2 : assignment.resubmissionPolicy === "LIMITED" ? 1 + (assignment.maxResubmissions ?? 0) : null;
    if (limit !== null && priorAttempts >= limit) {
      return NextResponse.json({ error: "You've used all the resubmission attempts allowed for this assignment." }, { status: 400 });
    }

    const nextSubmission = await prisma.assignmentSubmission.create({
      data: { assignmentId: params.id, traineeId: session.userId, attemptNumber: priorAttempts + 1, status: "IN_PROGRESS" },
    });

    if (assignment.resubmissionScope === "FAILED_QUESTIONS_ONLY") {
      const questions = await prisma.assignmentQuestion.findMany({
        where: { id: { in: latest.answers.map((a) => a.questionId) } },
        select: { id: true, maxMarks: true },
      });
      const maxMarksByQuestion = new Map(questions.map((q) => [q.id, q.maxMarks]));

      const decisions = decideCarryForward(
        latest.answers.map((a) => ({
          questionId: a.questionId,
          answerText: a.answerText,
          maxMarks: maxMarksByQuestion.get(a.questionId) ?? 0,
          aiScore: a.aiScore,
          instructorScore: a.instructorScore,
        })),
        assignment.failedQuestionThresholdPercent
      );

      for (const decision of decisions) {
        if (!decision.carryForward) continue; // reopened blank — no row needed yet, created lazily like any fresh question
        const previous = latest.answers.find((a) => a.questionId === decision.questionId)!;
        await prisma.assignmentAnswer.create({
          data: {
            submissionId: nextSubmission.id,
            questionId: decision.questionId,
            answerText: previous.answerText,
            lastSavedAt: new Date(),
            aiScore: previous.aiScore,
            aiMaxScore: previous.aiMaxScore,
            aiPercentage: previous.aiPercentage,
            aiCriteriaScores: previous.aiCriteriaScores ?? undefined,
            aiStrengths: previous.aiStrengths ?? undefined,
            aiAreasForImprovement: previous.aiAreasForImprovement ?? undefined,
            aiFeedback: previous.aiFeedback,
            aiConfidence: previous.aiConfidence,
            aiAssessedAt: previous.aiAssessedAt,
            instructorScore: previous.instructorScore,
            instructorFeedback: previous.instructorFeedback,
          },
        });
      }
    }

    return NextResponse.json({ submission: nextSubmission });
  });
}
