import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { checkInactivityForCourse } from "@/lib/earlyWarning";

/**
 * M38 — this GET is the actual "next natural touchpoint" the whole
 * inactivity design depends on: loading this page is what triggers
 * checkInactivityForCourse, since this project deliberately has no
 * background job that could do it on a schedule instead (see
 * InactivityAlert's own schema comment for the full reasoning).
 *
 * Ownership: ADMIN/INSTRUCTOR only see their own courses' alerts,
 * SUPER_ADMIN sees any — the same "visibility allows SUPER_ADMIN,
 * mutation doesn't" distinction courseOwnership.ts's own audit finding
 * already established for every other list/GET route in this project.
 * Deliberately NOT requireOwnedCourse, which has no SUPER_ADMIN bypass
 * by design — that's correct for a route that changes something, not
 * for one that only shows it.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const course = await prisma.course.findUnique({ where: { id: params.id }, select: { createdById: true } });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    // Fire the lazy inactivity check before reading anything back, so
    // this response reflects the check that just ran, not stale data
    // from whenever the dashboard was last opened.
    await checkInactivityForCourse(params.id);

    const [inactivityAlerts, failedAttemptsAlerts] = await Promise.all([
      prisma.inactivityAlert.findMany({
        where: { courseId: params.id },
        orderBy: { triggeredAt: "desc" },
        include: { trainee: { select: { id: true, name: true, email: true, lastLoginAt: true } } },
      }),
      // FailedAttemptsAlert has no direct courseId — it's scoped to a
      // specific exam (see that model's own schema comment for why) —
      // so reaching "every failed-attempts alert for this course"
      // means filtering through exam.courseModule.courseId, the same
      // relation name (not `module`) already verified against the
      // schema in earlyWarning.ts.
      prisma.failedAttemptsAlert.findMany({
        where: { exam: { courseModule: { courseId: params.id } } },
        orderBy: { triggeredAt: "desc" },
        include: {
          trainee: { select: { id: true, name: true, email: true } },
          exam: { select: { title: true } },
        },
      }),
    ]);

    return NextResponse.json({ inactivityAlerts, failedAttemptsAlerts });
  });
}
