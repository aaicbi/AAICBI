import { prisma } from "@/lib/prisma";

function httpError(status: number, message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

/**
 * Trainees who belong to an organization: those enrolled in at least one
 * course the organization owns (Course.createdById = its shadow staff
 * user). This is the same ownership convention every other org-scoped
 * route uses, so there is no second source of truth to drift.
 */
export function orgTraineeWhere(staffUserId: string) {
  return { courseEnrollments: { some: { course: { createdById: staffUserId } } } };
}

/** 403s unless the trainee belongs to the organization — blocks attributing another org's trainee. */
export async function requireOrgTrainee(org: { staffUserId: string | null }, traineeId: string) {
  if (!org.staffUserId) throw httpError(403, "Your organization has no courses yet.");
  const trainee = await prisma.trainee.findFirst({
    where: { id: traineeId, ...orgTraineeWhere(org.staffUserId) },
    select: { id: true, name: true },
  });
  if (!trainee) throw httpError(403, "That trainee is not enrolled in your organization.");
  return trainee;
}

/** 403s unless the course is one of the organization's own. */
export async function requireOrgCourse(org: { staffUserId: string | null }, courseId: string) {
  const course = org.staffUserId
    ? await prisma.course.findFirst({ where: { id: courseId, createdById: org.staffUserId }, select: { id: true, category: true } })
    : null;
  if (!course) throw httpError(403, "That program is not one of your organization's.");
  return course;
}
