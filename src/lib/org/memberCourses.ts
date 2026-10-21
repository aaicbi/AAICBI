import { prisma } from "@/lib/prisma";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { resolveOrgActor } from "./actor";
import { instructorCourseLimit } from "./people";

/**
 * For a signed-in staff-side account of a training organization: the course ids it is limited to, or null for no limit.
 * Only an organization's instructors are limited (to the courses the owner assigned); owners, admins, editors and viewers see the organization's courses.
 */
export async function orgInstructorCourseLimit(userId: string, email: string): Promise<string[] | null> {
  const org = await findTrainingOrgByStaffUserId(userId);
  if (!org) return null;
  const actor = await resolveOrgActor(org, email).catch(() => null);
  if (!actor || actor.role !== "INSTRUCTOR") return null;
  const [assigned, own] = await Promise.all([
    prisma.trainingOrganizationMemberCourse.findMany({ where: { memberId: actor.id }, select: { courseId: true } }),
    prisma.course.findMany({ where: { createdById: userId }, select: { id: true } }),
  ]);
  return instructorCourseLimit("INSTRUCTOR", assigned.map((a) => a.courseId), own.map((c) => c.id));
}

/** Of the course ids given, only those the organization's own account owns (never another organization's). */
export async function ownCourseIds(orgUserId: string | null, ids: string[]): Promise<string[]> {
  if (!orgUserId || !ids.length) return [];
  const rows = await prisma.course.findMany({ where: { id: { in: ids }, createdById: orgUserId }, select: { id: true } });
  return rows.map((r) => r.id);
}
