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

    const savedAt = new Date();
    const answer = await prisma.assignmentAnswer.upsert({
      where: { submissionId_questionId: { submissionId: submission.id, questionId: params.questionId } },
      create: { submissionId: submission.id, questionId: params.questionId, answerText: parsed.data.answerText, lastSavedAt: savedAt },
      update: { answerText: parsed.data.answerText, lastSavedAt: savedAt },
    });

    return NextResponse.json({ savedAt: answer.lastSavedAt });
  });
}
