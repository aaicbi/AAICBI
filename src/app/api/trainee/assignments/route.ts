import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/trainee/assignments — every PUBLISHED assignment attached
 * to a course (directly, or via one of its modules) the trainee has
 * real, active access to, same access condition hasCourseAccess itself
 * uses (unlockedAt set, accessRevokedAt null) — a trainee only
 * previewing a course, or whose access has lapsed, sees nothing here.
 * Student-safe fields only — no expectedAnswer/expectedConcepts/
 * rubric anywhere in this response; see assignmentOwnership.ts's own
 * comment for why that line is drawn at the route level, not the UI.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const activeCourseIds = (
      await prisma.courseEnrollment.findMany({
        where: { traineeId: session.userId, unlockedAt: { not: null }, accessRevokedAt: null },
        select: { courseId: true },
      })
    ).map((e) => e.courseId);

    if (activeCourseIds.length === 0) return NextResponse.json([]);

    const assignments = await prisma.assignment.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ courseId: { in: activeCourseIds } }, { module: { courseId: { in: activeCourseIds } } }],
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        course: { select: { id: true, title: true } },
        module: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
        submissions: {
          where: { traineeId: session.userId },
          orderBy: { attemptNumber: "desc" },
          take: 1,
          select: { id: true, status: true, attemptNumber: true, totalScore: true, maxScore: true, percentage: true, submittedAt: true },
        },
      },
      orderBy: { dueAt: "asc" },
    });

    return NextResponse.json(
      assignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueAt: a.dueAt,
        course: a.course ?? a.module?.course ?? null,
        latestSubmission: a.submissions[0] ?? null,
      }))
    );
  });
}
