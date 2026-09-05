/**
 * M18 — Course Access Control. The one function every trainee-facing
 * route under a course should use, rather than each writing its own
 * ad-hoc enrollment check — the roadmap's own warning about this
 * milestone is that the real risk isn't any one route being wrong,
 * it's missing one entirely, and a shared function makes "missing
 * one" mean "forgot to call this," not "wrote the check slightly
 * differently and got it wrong."
 */
import { prisma } from "@/lib/prisma";

/** True only when a real, unlocked, non-revoked CourseEnrollment row
 * exists for this trainee and course — the exact same condition
 * `checkInactivityForCourse` (M38) already uses to decide who counts
 * as "really" enrolled, not a new, separately-invented definition. */
export async function hasCourseAccess(traineeId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { traineeId, courseId, unlockedAt: { not: null }, accessRevokedAt: null },
    select: { id: true },
  });
  return enrollment !== null;
}

/** Throws a 403 if the trainee doesn't have access — deliberately
 * 403, not 404. Courses are publicly browsable (title, description,
 * whether it's free or paid) by design; only the actual content is
 * gated. A trainee without access should see "you're not enrolled,"
 * not be told the course doesn't exist, which would be actively
 * unhelpful for someone trying to figure out how to enroll. */
export async function requireCourseAccess(traineeId: string, courseId: string): Promise<void> {
  const access = await hasCourseAccess(traineeId, courseId);
  if (!access) {
    const err = new Error("You're not enrolled in this course yet.") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
