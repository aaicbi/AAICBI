import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hasCourseAccess } from "@/lib/courseAccess";
import { getModuleLockMap } from "@/lib/progress";
import { nextAttemptAllowedAt } from "@/lib/cooldownCore";
import { startAttempt, serveableQuestion, secondsRemaining } from "@/lib/examEngine";

/**
 * POST /api/courses/[id]/examination/attempts — the course-scoped
 * twin of POST /api/modules/[id]/attempts, adding the one genuinely
 * new check that milestone didn't need: the retake cooldown. Once past
 * that, this calls the exact same `startAttempt` from examEngine.ts,
 * completely unchanged — a course examination really is just another
 * Exam row, confirmed directly by that function's own signature taking
 * any Exam, never assuming a moduleId exists.
 *
 * Audit finding, closed here: nothing previously stopped a trainee
 * from starting this exam before completing any course content —
 * enrollment alone was enough. Since this exam is the actual
 * certificate-issuance gate (M23), that meant a trainee could
 * potentially earn a certificate without ever touching the course.
 * Enforced here server-side, not just hidden in the UI (see the course
 * detail route's own `allModulesComplete` field, which the frontend
 * uses to hide the link — but a hidden link is not a real boundary,
 * only this check is) — reuses the exact same `getModuleLockMap` the
 * course detail route already relies on for the identical
 * `completed` signal, not a second implementation that could drift
 * from it.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    // M18 — same enrollment gate as every other trainee-facing course
    // route this project already has.
    const enrolled = await hasCourseAccess(session.userId, params.id);
    if (!enrolled) {
      return NextResponse.json({ error: "This examination is not currently available." }, { status: 404 });
    }

    const modules = await prisma.module.findMany({ where: { courseId: params.id }, select: { id: true } });
    const lockMap = await getModuleLockMap(params.id, session.userId);
    const allModulesComplete = modules.length > 0 && modules.every((m: { id: string }) => lockMap[m.id]?.completed === true);
    if (!allModulesComplete) {
      return NextResponse.json(
        { error: "Complete every module in this course before attempting the course examination." },
        { status: 403 }
      );
    }

    const exam = await prisma.exam.findUnique({
      where: { courseId: params.id },
      include: { questions: { include: { options: true } } },
    });
    if (!exam || !exam.published) {
      return NextResponse.json({ error: "This examination is not currently available." }, { status: 404 });
    }

    // M22 — the retake cooldown, checked against this trainee's most
    // recent SUBMITTED attempt (an IN_PROGRESS one has nothing to cool
    // down from — startAttempt below already resumes that case) and
    // any staff-granted override.
    const [lastAttempt, override] = await Promise.all([
      prisma.attempt.findFirst({
        where: { examId: exam.id, traineeId: session.userId, status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
      }),
      prisma.cooldownOverride.findUnique({
        where: { traineeId_examId: { traineeId: session.userId, examId: exam.id } },
        select: { grantedAt: true },
      }),
    ]);

    const cooldownEndsAt = nextAttemptAllowedAt(
      exam.retakeCooldownHours,
      lastAttempt?.submittedAt ?? null,
      override?.grantedAt ?? null
    );
    if (cooldownEndsAt) {
      return NextResponse.json(
        { error: "You need to wait before retaking this examination.", cooldownEndsAt },
        { status: 403 }
      );
    }

    const { attempt, orderedQuestions } = await startAttempt(exam, session.userId);

    return NextResponse.json({
      attemptId: attempt.id,
      examTitle: exam.title,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      secondsRemaining: secondsRemaining(attempt),
      allowReview: exam.allowReview,
      questions: orderedQuestions.map((q) => serveableQuestion(q, exam.randomizeOptions)),
    });
  });
}
