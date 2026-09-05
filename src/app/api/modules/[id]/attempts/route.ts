import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { startAttempt, serveableQuestion, secondsRemaining } from "@/lib/examEngine";
import { getModuleLockStatus } from "@/lib/progress";
import { hasCourseAccess } from "@/lib/courseAccess";

/**
 * POST /api/modules/[id]/attempts — the M11 replacement for typing an
 * exam code. This is the entry point the roadmap's extension-points
 * doc calls out explicitly: "update src/app/api/attempts/route.ts to
 * take a moduleId instead of an examCode." Implemented as a new route
 * rather than an edit to that one, deliberately: POST /api/attempts
 * still works unchanged for the old by-code flow (see its own updated
 * comment) — a trainee reaching a module assessment through course
 * navigation and a trainee typing a legacy exam code are genuinely two
 * different entry points now, and this project's own established
 * pattern (courseOwnership.ts, the split rate-limit files) is "give
 * each real distinction its own small piece of code" rather than
 * branching one function on how it was called.
 *
 * Every attempt-scoped route downstream of this one — answers, submit,
 * heartbeat — needed zero changes: they already only take an attemptId,
 * with no idea whether that attempt started from a code or a module.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const exam = await prisma.exam.findUnique({
      where: { moduleId: params.id },
      include: {
        questions: { include: { options: true } },
        courseModule: { include: { course: true } },
      },
    });

    // Defense in depth, same reasoning as the course/module GET routes:
    // don't trust that "this module has a published assessment" also
    // means "the course it belongs to is published" — a course could
    // theoretically be unpublished again after a module's assessment
    // was published (nothing in this project prevents that sequence).
    // Same 404 regardless of which condition failed — never confirm
    // which one to an unauthorized caller.
    if (!exam || !exam.published || !exam.courseModule || !exam.courseModule.course.published) {
      return NextResponse.json(
        { error: "This assessment is not currently available." },
        { status: 404 }
      );
    }

    // M18 — the most serious gap this milestone found: this is the
    // actual entry point where a real, graded attempt begins. Before
    // this fix, an entirely unenrolled trainee could start (and
    // submit) a genuine attempt on any published course's first
    // module assessment, since module-locking alone doesn't require
    // enrollment — the first module of a course is unlocked by
    // default for anyone. Not a read-only content leak like the other
    // routes this pass fixed; this one could let someone actually
    // progress toward completion without ever being enrolled. Same
    // 404-not-403 reasoning as the checks above — don't confirm
    // anything about this assessment's existence to someone who was
    // never enrolled.
    const enrolled = await hasCourseAccess(session.userId, exam.courseModule.courseId);
    if (!enrolled) {
      return NextResponse.json(
        { error: "This assessment is not currently available." },
        { status: 404 }
      );
    }

    // M12: even a published assessment on a published course can't be
    // started if the module it belongs to is still locked for this
    // trainee — same enforcement-not-just-UI reasoning as
    // lessons/[id]/progress. A 403 here (not 404) is deliberate: unlike
    // the existence checks above, whether a module IS locked isn't
    // something worth hiding — the trainee already sees it's locked on
    // the course page.
    const lockStatus = await getModuleLockStatus(exam.courseModule.courseId, params.id, session.userId);
    if (!lockStatus?.unlocked) {
      return NextResponse.json(
        { error: "This module isn't unlocked yet — complete the previous module first." },
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

/**
 * GET /api/modules/[id]/attempts — a trainee's own attempt history for
 * this module's assessment: used by the course view to show "Best:
 * 85% — Passed" / "2 of 3 attempts used" without exposing anyone
 * else's results. Deliberately narrow fields — no questionOrder, no
 * per-answer detail, nothing that would let a trainee reconstruct the
 * bank from their own attempt history.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const exam = await prisma.exam.findUnique({
      where: { moduleId: params.id },
      select: { id: true, maxAttempts: true, courseModule: { select: { courseId: true } } },
    });
    if (!exam) {
      return NextResponse.json({ error: "This module doesn't have an assessment yet." }, { status: 404 });
    }

    // M18 — same gate as POST above, for consistency: this only ever
    // returns the trainee's own (already-scoped) attempt history, so
    // the risk here is smaller than POST's, but an unenrolled trainee
    // still shouldn't be able to confirm whether a module has an
    // assessment at all.
    if (exam.courseModule) {
      const enrolled = await hasCourseAccess(session.userId, exam.courseModule.courseId);
      if (!enrolled) {
        return NextResponse.json({ error: "This module doesn't have an assessment yet." }, { status: 404 });
      }
    }

    const attempts = await prisma.attempt.findMany({
      where: { examId: exam.id, traineeId: session.userId },
      orderBy: { attemptNumber: "desc" },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        score: true,
        totalQuestions: true,
        percentage: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });

    return NextResponse.json({
      maxAttempts: exam.maxAttempts,
      attempts,
    });
  });
}
