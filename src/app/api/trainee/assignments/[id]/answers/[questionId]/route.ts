import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const SaveSchema = z.object({ answerText: z.string().max(50_000) });

/**
 * PUT /api/trainee/assignments/[id]/answers/[questionId] — the
 * autosave endpoint, called by the workspace's own debounced client
 * logic (~2s after the trainee stops typing). Upserts onto the
 * trainee's own current (highest attemptNumber) submission only, and
 * only while it's still IN_PROGRESS — editing after submission is
 * gated by Assignment.allowEditAfterSubmission, never silently allowed
 * just because this route was called.
 *
 * Phase 2 — a FAILED_QUESTIONS_ONLY resubmission carries a passing
 * question's answer AND its score forward (see the resubmit route's
 * own comment). If a trainee then deliberately edits that carried-
 * forward answer anyway, its now-stale AI score is cleared here — the
 * text changed, so the old grade no longer describes it, and
 * assignmentGrading.ts's own "skip already-scored answers" check
 * (which is what makes carrying forward NOT re-bill an AI call for
 * untouched answers) correctly re-grades it on next submit instead of
 * keeping a grade that no longer matches what's actually written.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string; questionId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = SaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid answer." }, { status: 400 });
    }

    const submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: params.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
      include: { assignment: { select: { allowEditAfterSubmission: true } } },
    });
    if (!submission) {
      return NextResponse.json({ error: "Start the assignment before saving an answer." }, { status: 404 });
    }
    if (submission.status !== "IN_PROGRESS" && !submission.assignment.allowEditAfterSubmission) {
      return NextResponse.json({ error: "This submission can no longer be edited." }, { status: 409 });
    }

    const question = await prisma.assignmentQuestion.findUnique({
      where: { id: params.questionId },
      select: { id: true, assignmentId: true },
    });
    if (!question || question.assignmentId !== params.id) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const existing = await prisma.assignmentAnswer.findUnique({
      where: { submissionId_questionId: { submissionId: submission.id, questionId: params.questionId } },
      select: { answerText: true, aiScore: true },
    });
    const textChanged = existing !== null && existing.answerText !== parsed.data.answerText;
    const clearStaleScore = textChanged && existing!.aiScore !== null;

    const savedAt = new Date();
    const answer = await prisma.assignmentAnswer.upsert({
      where: { submissionId_questionId: { submissionId: submission.id, questionId: params.questionId } },
      create: { submissionId: submission.id, questionId: params.questionId, answerText: parsed.data.answerText, lastSavedAt: savedAt },
      update: {
        answerText: parsed.data.answerText,
        lastSavedAt: savedAt,
        ...(clearStaleScore
          ? { aiScore: null, aiMaxScore: null, aiPercentage: null, aiFeedback: null, instructorScore: null, instructorFeedback: null }
          : {}),
      },
    });

    return NextResponse.json({ savedAt: answer.lastSavedAt });
  });
}
