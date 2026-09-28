import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";

/**
 * Used to be deliberately anonymous/public — this is what the student's
 * "enter your exam code" and instructions screens call before any
 * attempt exists. Since M9, a trainee is always authenticated before
 * reaching this page (see ExamEntryPage's own comment), so this now
 * requires that session directly rather than trusting the page wrapper
 * alone — a hidden link was never a real boundary.
 *
 * Standalone-exam access control: a by-code exam with no courseId and
 * no moduleId is only visible to a trainee with a non-revoked
 * ExamAccessGrant (see that model's own comment) — closing the gap
 * this route's own prior comment flagged ("any trainee who knows the
 * code" could reach a published standalone exam with no per-trainee
 * check at all). An exam that DOES belong to a course or module is
 * refused here outright — that was a second, related gap the same
 * comment flagged: nothing stopped a course/module exam from being
 * started via this code path, bypassing course enrollment entirely.
 * Those exams are only ever reachable through their real course/module
 * routes now. Only ever returns fields safe for a pre-attempt screen —
 * never question content, option text, or anything answer-shaped.
 * §19: don't expose sensitive administrative information in the
 * student URL/response.
 */
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session || session.role !== "TRAINEE") {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const exam = await prisma.exam.findUnique({
      where: { code: params.code.toUpperCase() },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        instructions: true,
        durationMinutes: true,
        numQuestions: true,
        published: true,
        monitoringEnabled: true,
        certificateEnabled: true,
        courseId: true,
        moduleId: true,
        _count: { select: { questions: true } },
      },
    });

    if (!exam || !exam.published || exam.courseId || exam.moduleId) {
      return NextResponse.json(
        { error: "Examination not found, or it is not currently open." },
        { status: 404 }
      );
    }

    const grant = await prisma.examAccessGrant.findUnique({
      where: { examId_traineeId: { examId: exam.id, traineeId: session.userId } },
      select: { revokedAt: true },
    });
    if (!grant || grant.revokedAt) {
      return NextResponse.json(
        { error: "Examination not found, or it is not currently open." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: exam.code,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.numQuestions ?? exam._count.questions,
      monitoringEnabled: exam.monitoringEnabled,
      certificateEnabled: exam.certificateEnabled,
    });
  });
}
