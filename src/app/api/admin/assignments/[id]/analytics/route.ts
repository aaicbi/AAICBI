import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";
import { computeAssignmentOverallStats, computeQuestionStats } from "@/lib/assignmentAnalytics";

/**
 * GET /api/admin/assignments/[id]/analytics — §26/§27. One query for
 * the overall numbers, one for the per-question breakdown; the actual
 * math lives in assignmentAnalytics.ts's pure functions so it's
 * unit-tested without a database.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const assignment = await requireOwnedAssignment(params.id, session.userId, session.role);

    const courseId = assignment.courseId ?? (await prisma.module.findUnique({ where: { id: assignment.moduleId ?? "" }, select: { courseId: true } }))?.courseId;
    const assignedCount = courseId
      ? await prisma.courseEnrollment.count({ where: { courseId, unlockedAt: { not: null }, accessRevokedAt: null } })
      : 0;

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: params.id },
      select: { attemptNumber: true, status: true, percentage: true },
    });
    const overall = computeAssignmentOverallStats(submissions, assignedCount);

    const questions = await prisma.assignmentQuestion.findMany({
      where: { assignmentId: params.id },
      orderBy: { order: "asc" },
      select: { id: true, questionNumber: true, questionText: true, maxMarks: true },
    });
    const answers = await prisma.assignmentAnswer.findMany({
      where: { submission: { assignmentId: params.id } },
      select: { questionId: true, aiScore: true, instructorScore: true, question: { select: { maxMarks: true } } },
    });
    const questionStats = computeQuestionStats(
      answers.map((a) => ({ questionId: a.questionId, score: a.instructorScore ?? a.aiScore, maxMarks: a.question.maxMarks })),
      questions.map((q) => q.id)
    );

    return NextResponse.json({
      overall,
      questions: questions.map((q) => ({
        ...q,
        stats: questionStats.find((s) => s.questionId === q.id)!,
      })),
    });
  });
}
