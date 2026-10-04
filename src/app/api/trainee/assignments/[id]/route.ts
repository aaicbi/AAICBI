import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

// The ONE select every trainee-facing assignment-question lookup in
// this app must use — never the full row. expectedAnswer,
// expectedConcepts, keywords, and rubric are deliberately absent, full
// stop, not hidden client-side. Same discipline as the exam engine's
// own "never select isCorrect/explanation for an in-progress attempt."
const STUDENT_SAFE_QUESTION_SELECT = {
  id: true,
  section: true,
  questionNumber: true,
  parentQuestionId: true,
  type: true,
  questionText: true,
  instructions: true,
  referenceMaterial: true,
  maxMarks: true,
  order: true,
} as const;

/**
 * GET /api/trainee/assignments/[id] — lazily creates an IN_PROGRESS
 * submission the FIRST time a trainee opens a published assignment
 * (same lazy-creation spirit as other enrollment flows in this app),
 * then returns it alongside the student-safe question list and the
 * trainee's own saved answers. A submission already past IN_PROGRESS
 * is returned read-only — the workspace UI redirects to the result
 * page instead of showing answer editors.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        instructions: true,
        status: true,
        dueAt: true,
        lateSubmissionPolicy: true,
        allowEditAfterSubmission: true,
        resubmissionPolicy: true,
        maxResubmissions: true,
        courseId: true,
        module: { select: { courseId: true } },
        questions: { select: STUDENT_SAFE_QUESTION_SELECT, orderBy: { order: "asc" } },
      },
    });
    if (!assignment || assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const courseId = assignment.courseId ?? assignment.module?.courseId ?? null;
    if (!courseId) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: { traineeId: session.userId, courseId, unlockedAt: { not: null }, accessRevokedAt: null },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "You're not enrolled in this course yet." }, { status: 403 });
    }

    let submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: params.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
      include: { answers: { select: { id: true, questionId: true, answerText: true, lastSavedAt: true } } },
    });

    if (!submission) {
      submission = await prisma.assignmentSubmission.create({
        data: { assignmentId: params.id, traineeId: session.userId, attemptNumber: 1, status: "IN_PROGRESS" },
        include: { answers: { select: { id: true, questionId: true, answerText: true, lastSavedAt: true } } },
      });
    }

    return NextResponse.json({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      instructions: assignment.instructions,
      dueAt: assignment.dueAt,
      lateSubmissionPolicy: assignment.lateSubmissionPolicy,
      allowEditAfterSubmission: assignment.allowEditAfterSubmission,
      resubmissionPolicy: assignment.resubmissionPolicy,
      maxResubmissions: assignment.maxResubmissions,
      questions: assignment.questions,
      courseId,
      submission,
    });
  });
}
