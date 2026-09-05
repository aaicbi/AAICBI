import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { hasCourseAccess } from "@/lib/courseAccess";
import { nextAttemptAllowedAt } from "@/lib/cooldownCore";

/**
 * GET /api/courses/[id]/examination — same role-branching shape as
 * GET /api/modules/[id]/assessment: staff get the full review view
 * (every question, source cross-references, needsReview flags); a
 * trainee gets narrow, published-only metadata plus their own cooldown
 * status — never another trainee's data, never an unpublished exam's
 * questions.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "INSTRUCTOR";

    if (isStaff) {
      await requireOwnedCourse(params.id, session.userId);
      const exam = await prisma.exam.findUnique({
        where: { courseId: params.id },
        include: {
          questions: {
            include: {
              options: true,
              generatedFromQuestion: { select: { id: true, text: true, options: { select: { text: true, isCorrect: true } } } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!exam) {
        return NextResponse.json({ error: "No course examination has been generated yet." }, { status: 404 });
      }
      return NextResponse.json(exam);
    }

    // Trainee path.
    const enrolled = await hasCourseAccess(session.userId, params.id);
    if (!enrolled) {
      return NextResponse.json({ error: "This examination is not currently available." }, { status: 404 });
    }

    const exam = await prisma.exam.findUnique({
      where: { courseId: params.id },
      select: {
        id: true,
        title: true,
        instructions: true,
        durationMinutes: true,
        passMarkPercent: true,
        maxAttempts: true,
        published: true,
        retakeCooldownHours: true,
        _count: { select: { questions: true } },
      },
    });
    if (!exam || !exam.published) {
      return NextResponse.json({ error: "This examination is not currently available." }, { status: 404 });
    }

    const [attempts, override] = await Promise.all([
      prisma.attempt.findMany({
        where: { examId: exam.id, traineeId: session.userId },
        orderBy: { attemptNumber: "desc" },
        select: { attemptNumber: true, status: true, percentage: true, passed: true, submittedAt: true },
      }),
      prisma.cooldownOverride.findUnique({
        where: { traineeId_examId: { traineeId: session.userId, examId: exam.id } },
        select: { grantedAt: true },
      }),
    ]);

    const lastSubmitted = attempts.find((a: { status: string }) => a.status === "SUBMITTED");
    const cooldownEndsAt = nextAttemptAllowedAt(
      exam.retakeCooldownHours,
      lastSubmitted?.submittedAt ?? null,
      override?.grantedAt ?? null
    );

    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      passMarkPercent: exam.passMarkPercent,
      maxAttempts: exam.maxAttempts,
      totalQuestions: exam._count.questions,
      attempts,
      cooldownEndsAt,
    });
  });
}
