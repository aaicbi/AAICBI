import { prisma } from "@/lib/prisma";
import type { ResourceType } from "@/lib/collab/core";

/**
 * Who may edit what, in the database. "Owner" is the creator (or, for an organization, the organization's own account) and
 * a super admin; "editor" is someone who joined through a share link. The owner-or-editor test is what the ownership helpers
 * in courseOwnership.ts and assignmentOwnership.ts use, so every route that already checked ownership accepts an editor
 * without changing.
 */
export type Access = "owner" | "editor" | null;

export async function isCollaborator(userId: string, type: ResourceType, id: string): Promise<boolean> {
  return !!(await prisma.contentCollaborator.findUnique({ where: { resourceType_resourceId_userId: { resourceType: type, resourceId: id, userId } }, select: { id: true } }));
}

export async function courseAccess(course: { id: string; createdById: string }, userId: string, role?: string): Promise<Access> {
  if (role === "SUPER_ADMIN" || course.createdById === userId) return "owner";
  return (await isCollaborator(userId, "COURSE", course.id)) ? "editor" : null;
}

export async function examAccess(exam: { id: string; createdById: string; courseId: string | null; moduleId: string | null }, userId: string): Promise<Access> {
  if (exam.createdById === userId) return "owner";
  if (await isCollaborator(userId, "EXAM", exam.id)) return "editor";
  const courseId = exam.courseId ?? (exam.moduleId ? (await prisma.module.findUnique({ where: { id: exam.moduleId }, select: { courseId: true } }))?.courseId : null);
  return courseId && (await isCollaborator(userId, "COURSE", courseId)) ? "editor" : null;
}

export async function assignmentAccess(a: { id: string; createdById: string; courseId: string | null; moduleId: string | null }, userId: string, role?: string): Promise<Access> {
  if (role === "SUPER_ADMIN" || a.createdById === userId) return "owner";
  if (await isCollaborator(userId, "ASSIGNMENT", a.id)) return "editor";
  const courseId = a.courseId ?? (a.moduleId ? (await prisma.module.findUnique({ where: { id: a.moduleId }, select: { courseId: true } }))?.courseId : null);
  return courseId && (await isCollaborator(userId, "COURSE", courseId)) ? "editor" : null;
}

/** Ids this person was invited into, by kind, for lists ("shared with me"). Editing a course also covers its modules' assessments. */
export async function sharedIds(userId: string): Promise<{ COURSE: string[]; EXAM: string[]; ASSIGNMENT: string[] }> {
  const rows = await prisma.contentCollaborator.findMany({ where: { userId }, select: { resourceType: true, resourceId: true } });
  const out = { COURSE: [] as string[], EXAM: [] as string[], ASSIGNMENT: [] as string[] };
  for (const r of rows) if (r.resourceType === "COURSE" || r.resourceType === "EXAM" || r.resourceType === "ASSIGNMENT") out[r.resourceType].push(r.resourceId);
  return out;
}

/** A `where` that matches what this person owns plus what was shared with them. Super admins keep seeing everything. */
export async function ownedOrSharedWhere(session: { userId: string; role: string }, type: ResourceType): Promise<{ OR: Array<Record<string, unknown>> } | undefined> {
  if (session.role === "SUPER_ADMIN") return undefined;
  const shared = (await sharedIds(session.userId))[type];
  return { OR: [{ createdById: session.userId }, ...(shared.length ? [{ id: { in: shared } }] : [])] };
}

/** Examinations a person may list: their own, ones shared with them, and every assessment of a course shared with them. */
export async function examsListWhere(session: { userId: string; role: string }): Promise<Record<string, unknown> | undefined> {
  if (session.role === "SUPER_ADMIN") return undefined;
  const shared = await sharedIds(session.userId);
  return {
    OR: [
      { createdById: session.userId },
      ...(shared.EXAM.length ? [{ id: { in: shared.EXAM } }] : []),
      ...(shared.COURSE.length ? [{ courseId: { in: shared.COURSE } }, { courseModule: { courseId: { in: shared.COURSE } } }] : []),
    ],
  };
}

export async function assignmentsListWhere(session: { userId: string; role: string }): Promise<Record<string, unknown> | undefined> {
  if (session.role === "SUPER_ADMIN") return undefined;
  const shared = await sharedIds(session.userId);
  return {
    OR: [
      { createdById: session.userId },
      ...(shared.ASSIGNMENT.length ? [{ id: { in: shared.ASSIGNMENT } }] : []),
      ...(shared.COURSE.length ? [{ courseId: { in: shared.COURSE } }, { module: { courseId: { in: shared.COURSE } } }] : []),
    ],
  };
}
