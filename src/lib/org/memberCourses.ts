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

type Target = Exclude<NonNullable<import("./people").InstructorTarget>, "deny">;

/** The course an item belongs to, or null when it has none (a standalone exam) and undefined when the item does not exist. */
export async function courseOfTarget(t: Target): Promise<string | null | undefined> {
  const pick = <T>(row: T | null, f: (r: T) => string | null) => (row ? f(row) : undefined);
  switch (t.kind) {
    case "course": return pick(await prisma.course.findUnique({ where: { id: t.id }, select: { id: true } }), (r) => r.id);
    case "module": return pick(await prisma.module.findUnique({ where: { id: t.id }, select: { courseId: true } }), (r) => r.courseId);
    case "lesson": return pick(await prisma.lesson.findUnique({ where: { id: t.id }, select: { module: { select: { courseId: true } } } }), (r) => r.module.courseId);
    case "material": return pick(await prisma.material.findUnique({ where: { id: t.id }, select: { lesson: { select: { module: { select: { courseId: true } } } } } }), (r) => r.lesson.module.courseId);
    case "cohort": return pick(await prisma.cohort.findUnique({ where: { id: t.id }, select: { courseId: true } }), (r) => r.courseId);
    case "certificate": return pick(await prisma.certificate.findUnique({ where: { id: t.id }, select: { courseId: true } }), (r) => r.courseId);
    case "exam": return pick(await prisma.exam.findUnique({ where: { id: t.id }, select: { courseId: true, courseModule: { select: { courseId: true } } } }), (r) => r.courseId ?? r.courseModule?.courseId ?? null);
    case "question": return pick(await prisma.question.findUnique({ where: { id: t.id }, select: { exam: { select: { courseId: true, courseModule: { select: { courseId: true } } } } } }), (r) => r.exam.courseId ?? r.exam.courseModule?.courseId ?? null);
    case "assignment": return pick(await prisma.assignment.findUnique({ where: { id: t.id }, select: { courseId: true, module: { select: { courseId: true } } } }), (r) => r.courseId ?? r.module?.courseId ?? null);
  }
}

/** Throws a 403 message when an instructor's write is outside the courses they were given. Resolves to nothing otherwise. */
export async function instructorWriteVerdict(memberId: string, method: string, path: string): Promise<string | null> {
  const { instructorTarget } = await import("./people");
  const target = instructorTarget(method, path);
  if (!target) return null;
  if (target === "deny") return "Instructors cannot create courses or standalone items, share content or change certificate templates. Ask an admin or the owner.";
  const courseId = await courseOfTarget(target);
  if (courseId === undefined) return null; // not found: the route answers 404
  if (courseId === null) return "That item is not part of a course, so an instructor cannot change it. Ask an admin or the owner.";
  const given = await prisma.trainingOrganizationMemberCourse.findUnique({ where: { memberId_courseId: { memberId, courseId } }, select: { id: true } });
  return given ? null : "That course is not one of yours. Ask the owner to give you the course.";
}
