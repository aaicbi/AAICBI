import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

/**
 * DELETE /api/cohorts/[id]/enrollments/[traineeId] — remove a trainee
 * from a cohort roster. Deliberately doesn't touch the trainee's
 * actual progress, attempts, or certificate for the course — removing
 * someone from a roster is a labeling/reporting change, never a
 * destructive one against real performance data, consistent with this
 * project's standing rule throughout M11-M15.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; traineeId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const cohort = await prisma.cohort.findUnique({ where: { id: params.id }, select: { courseId: true } });
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
    }
    await requireOwnedCourse(cohort.courseId, session.userId);

    await prisma.enrollmentRecord
      .delete({ where: { cohortId_traineeId: { cohortId: params.id, traineeId: params.traineeId } } })
      .catch(() => {}); // already not enrolled — fine, not an error
    return NextResponse.json({ ok: true });
  });
}
