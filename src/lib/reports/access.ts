import { prisma } from "@/lib/prisma";
import { orgInstructorCourseLimit } from "@/lib/org/memberCourses";

export interface ReportViewer { userId: string; role: string; email?: string }
export type Scope = { all: true; courseIds?: undefined; note: string } | { all: false; courseIds: string[]; note: string };

/** Which courses a staff member may report on: the Super Admin all of them; an organization or instructor only the courses they created. */
export async function staffScope(v: ReportViewer): Promise<Scope | null> {
  if (v.role === "SUPER_ADMIN") return { all: true, note: "All of this trainee's activity on the platform." };
  if (v.role !== "ADMIN" && v.role !== "INSTRUCTOR") return null;
  const courses = await prisma.course.findMany({ where: { createdById: v.userId }, select: { id: true } });
  // An organization's instructor sees only the courses the owner assigned to them.
  const limit = v.email ? await orgInstructorCourseLimit(v.userId, v.email) : null;
  const ids = limit ? courses.map((c) => c.id).filter((id) => limit.includes(id)) : courses.map((c) => c.id);
  return { all: false, courseIds: ids, note: "Covers this trainee's work in your courses only. Login and activity figures are counted across the platform." };
}

/** The scope for one trainee, or null if this person has no right to see them (not enrolled in any of their courses). */
export async function scopeForTrainee(v: ReportViewer, traineeId: string): Promise<{ courseIds?: string[]; scopeNote: string } | null> {
  const sc = await staffScope(v);
  if (!sc) return null;
  if (sc.all) return { scopeNote: sc.note };
  const enr = await prisma.courseEnrollment.findMany({ where: { traineeId, courseId: { in: sc.courseIds } }, select: { courseId: true } });
  if (!enr.length) return null;
  return { courseIds: enr.map((e) => e.courseId), scopeNote: sc.note };
}

/** Course ids a staff member's roster covers, optionally narrowed to one course they may see. */
export async function rosterCourseIds(v: ReportViewer, courseId?: string | null): Promise<string[] | null> {
  const sc = await staffScope(v);
  if (!sc) return null;
  const all = sc.all ? (await prisma.course.findMany({ select: { id: true } })).map((c) => c.id) : sc.courseIds;
  if (courseId) return all.includes(courseId) ? [courseId] : null;
  return all;
}
