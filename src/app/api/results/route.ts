import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedExam, createdByFilter } from "@/lib/courseOwnership";

/**
 * GET /api/results
 *
 * M13 audit finding, serious: this route had no ownership check at
 * all. With `examId` provided, any INSTRUCTOR could view any OTHER
 * instructor's exam results by guessing/enumerating an exam id —
 * trainee names, emails, scores, all of it. Without `examId`, it
 * returned EVERY attempt across the ENTIRE platform to any staff
 * account — every instructor's every trainee's every result, no
 * scoping at all. The admin results page (the only UI caller) always
 * passes `examId`, so the unscoped mode was reachable only via a
 * direct API call — dead surface from the UI's perspective, but very
 * much live from an API-request perspective, and the worse of the two
 * gaps.
 *
 * Fixed the same way every other exam-scoped route in this project
 * already was (see security-notes.md §7): `examId` provided → real
 * ownership check via requireOwnedExam. `examId` omitted → scoped to
 * "every exam I own," not "every exam anyone owns" — this keeps the
 * useful all-my-exams view working, it just can't cross into someone
 * else's data anymore.
 *
 * Whole-project audit finding: SUPER_ADMIN now sees every exam's
 * results, both in the unscoped "all my exams" mode (via
 * createdByFilter — see its own comment) and when a specific `examId`
 * is given. That second part needs its own small carve-out rather than
 * reusing createdByFilter directly: requireOwnedExam is also the same
 * check used to gate EDITING and DELETING an exam elsewhere, and that
 * stays strict with no SUPER_ADMIN bypass, on purpose (see
 * courseOwnership.ts). Viewing results isn't the same class of action
 * as modifying the exam, so SUPER_ADMIN skips the ownership check here
 * specifically — but still gets a proper 404 for a genuinely
 * nonexistent exam id, not silent success on garbage input.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId") ?? undefined;
    const status = searchParams.get("status"); // "pass" | "fail" | undefined
    const search = searchParams.get("q") ?? undefined;

    if (examId) {
      if (session.role === "SUPER_ADMIN") {
        const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
        if (!exam) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
      } else {
        await requireOwnedExam(examId, session.userId);
      }
    }

    const attempts = await prisma.attempt.findMany({
      where: {
        examId,
        // Only reached when examId is omitted — scopes to exams this
        // staff member actually owns, unless they're SUPER_ADMIN (see
        // createdByFilter), never the whole platform for anyone else.
        exam: examId ? undefined : createdByFilter(session),
        status: "SUBMITTED",
        passed: status === "pass" ? true : status === "fail" ? false : undefined,
        trainee: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
      },
      include: {
        trainee: true,
        exam: { select: { title: true, code: true } },
        performanceSummary: { select: { strengths: true, weaknesses: true, narrative: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    const totalTrainees = new Set(attempts.map((a: { traineeId: string }) => a.traineeId)).size;
    const passed = attempts.filter((a: { passed: boolean | null }) => a.passed).length;
    const avgScore =
      attempts.length > 0
        ? Math.round(attempts.reduce((sum: number, a: { percentage: number | null }) => sum + (a.percentage ?? 0), 0) / attempts.length)
        : 0;
    const highScore =
      attempts.length > 0 ? Math.round(Math.max(...attempts.map((a: { percentage: number | null }) => a.percentage ?? 0))) : 0;

    return NextResponse.json({
      summary: {
        totalTrainees,
        testsCompleted: attempts.length,
        passed,
        failed: attempts.length - passed,
        averageScore: avgScore,
        highestScore: highScore,
      },
      attempts,
    });
  });
}
