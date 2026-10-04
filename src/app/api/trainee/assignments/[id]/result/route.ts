import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/trainee/assignments/[id]/result — the trainee's own score +
 * feedback, once assessed (or the current pending/manual status before
 * then). Student-safe per-answer fields only: the AI/instructor score
 * and FEEDBACK are shown (that's the whole point — §14's "help the
 * student improve"), but expectedAnswer/expectedConcepts/rubric are
 * never included, same discipline as every other trainee-facing route.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const assignment = await prisma.assignment.findUnique({ where: { id: params.id }, select: { id: true, title: true } });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: params.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
      include: {
        answers: {
          include: { question: { select: { id: true, questionNumber: true, questionText: true, maxMarks: true, order: true } } },
          orderBy: { question: { order: "asc" } },
        },
      },
    });
    if (!submission) {
      return NextResponse.json({ error: "No submission found for this assignment yet." }, { status: 404 });
    }

    return NextResponse.json({
      assignmentTitle: assignment.title,
      status: submission.status,
      attemptNumber: submission.attemptNumber,
      submittedAt: submission.submittedAt,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      overallFeedback: submission.overallFeedback,
      overallStrengths: submission.overallStrengths,
      overallAreasForImprovement: submission.overallAreasForImprovement,
      instructorComments: submission.instructorComments,
      answers: submission.answers.map((a) => ({
        questionNumber: a.question.questionNumber,
        questionText: a.question.questionText,
        maxMarks: a.question.maxMarks,
        answerText: a.answerText,
        score: a.instructorScore ?? a.aiScore,
        scoreSource: a.instructorScore !== null ? "instructor" : a.aiScore !== null ? "ai" : null,
        feedback: a.instructorFeedback ?? a.aiFeedback,
        strengths: a.aiStrengths,
        areasForImprovement: a.aiAreasForImprovement,
      })),
    });
  });
}
