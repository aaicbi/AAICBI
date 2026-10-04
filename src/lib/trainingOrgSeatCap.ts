/**
 * Direct platform-fee billing — the trainee seat cap. A total per
 * organization, not per course (confirmed during planning): any
 * trainee with real, active access to ANY of a DIRECT_PAYMENT
 * organization's courses counts toward it, regardless of how they got
 * it (free, admin-granted, or paid) — the cap is about how many people
 * this organization can train in total, not specifically how many
 * paid. PREVIEW-source rows (unlockedAt null) never count or consume a
 * seat — a free preview is a courtesy sample, not real access, the
 * same distinction hasCourseAccess itself already draws.
 */
import { prisma } from "@/lib/prisma";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * Whether a brand-new `CourseEnrollment` row can be created for this
 * trainee on this course. Only ever consulted before creating a NEW
 * row — a renewal/reactivation of an existing one is the same,
 * already-counted trainee and should never call this at all (see each
 * call site's own comment on where exactly that line falls).
 *
 * A trainee who already has active access to a DIFFERENT course from
 * the SAME organization doesn't consume a second seat — checked first,
 * before counting against the cap at all.
 */
export async function hasAvailableTrainingSeat(courseId: string, traineeId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
  if (!course) return true;

  const org = await findTrainingOrgByStaffUserId(course.createdById);
  if (!org || org.billingModel !== "DIRECT_PAYMENT" || org.accessBlockWaived || !org.trainingSeatCap) {
    // Not a capped DIRECT_PAYMENT organization at all, or SUPER_ADMIN
    // has waived blocking entirely, or no cap has been set — unlimited.
    return true;
  }

  const alreadyATrainee = await prisma.courseEnrollment.findFirst({
    where: {
      traineeId,
      unlockedAt: { not: null },
      accessRevokedAt: null,
      course: { createdById: course.createdById },
    },
    select: { id: true },
  });
  if (alreadyATrainee) return true;

  const activeCount = await countActiveTrainingOrgTrainees(course.createdById);
  return activeCount < org.trainingSeatCap;
}

/**
 * The organization's current seat usage — reused by
 * hasAvailableTrainingSeat above and by the admin list's own "12 / 50"
 * display (GET /api/admin/training-organizations).
 */
export async function countActiveTrainingOrgTrainees(staffUserId: string): Promise<number> {
  const distinctTrainees = await prisma.courseEnrollment.findMany({
    where: { unlockedAt: { not: null }, accessRevokedAt: null, course: { createdById: staffUserId } },
    distinct: ["traineeId"],
    select: { traineeId: true },
  });
  return distinctTrainees.length;
}
