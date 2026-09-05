import { prisma } from "@/lib/prisma";

/**
 * Shared "does this staff member actually own the course this item
 * belongs to" checks, used by every module/lesson/material PUT/DELETE
 * route. Written once here instead of copy-pasted per route so the
 * ownership walk (material → lesson → module → course → createdById)
 * can't silently drift between routes over time.
 *
 * Each throws a 404-shaped error rather than returning null — same
 * reasoning as courses/[id]/route.ts: don't distinguish "doesn't exist"
 * from "exists but isn't yours" in the response.
 */
function notFound(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  return err;
}

export async function requireOwnedCourse(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.createdById !== userId) throw notFound("Course not found.");
  return course;
}

export async function requireOwnedModule(moduleId: string, userId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: true },
  });
  if (!mod || mod.course.createdById !== userId) throw notFound("Module not found.");
  return mod;
}

export async function requireOwnedLesson(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson || lesson.module.course.createdById !== userId) throw notFound("Lesson not found.");
  return lesson;
}

export async function requireOwnedMaterial(materialId: string, userId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { lesson: { include: { module: { include: { course: true } } } } },
  });
  if (!material || material.lesson.module.course.createdById !== userId) throw notFound("Material not found.");
  return material;
}

// -----------------------------------------------------------------------
// M11 audit finding: every exam-scoped route (src/app/api/exams/[id]/*,
// src/app/api/exams/[id]/questions, src/app/api/questions/[id]) only
// ever called requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR") with no
// check that the requesting staff member actually owns the exam being
// read/edited/deleted — unlike every course/module/lesson/material
// route, which all walk an ownership chain via the helpers above. That
// gap predates M11 (it shipped with M9's ported exam engine, before
// Course/createdById-scoped ownership existed as a pattern at all) but
// M11 is exactly where it stops being theoretical: module-scoped exams
// now sit one level inside a real ownership tree (Exam -> Module ->
// Course -> createdById), so any INSTRUCTOR could otherwise view,
// silently edit, or delete another instructor's module assessment (or
// its questions, or its results) by guessing/enumerating a cuid. Fixed
// here, once, the same way every other resource in this project is
// ownership-checked — not special-cased per route.
//
// Deliberately the same design choice as every helper above: no
// SUPER_ADMIN bypass. That's consistent with how course ownership
// already worked before this fix (requireOwnedCourse has never granted
// one either) — introducing a bypass only for exams would be a new,
// asymmetric behavior, not a restoration of an old one.
export async function requireOwnedExam(examId: string, userId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.createdById !== userId) throw notFound("Examination not found.");
  return exam;
}

export async function requireOwnedQuestion(questionId: string, userId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { exam: true },
  });
  if (!question || question.exam.createdById !== userId) throw notFound("Question not found.");
  return question;
}

// -----------------------------------------------------------------------
// Whole-project audit finding: SUPER_ADMIN never actually meant anything
// beyond ADMIN/INSTRUCTOR anywhere in this codebase. Every list/GET
// route above (and the ones this helper now scopes) filtered to
// `createdById: session.userId` regardless of role, so the org owner
// had the exact same "only what I personally created" view as any
// individual instructor — no way to see across their own team as it
// grows. Confirmed by grep across the whole project: 23 files use the
// identical three-role `requireRole("SUPER_ADMIN", "ADMIN",
// "INSTRUCTOR")` bundle, and SUPER_ADMIN was never referenced anywhere
// else except this role list and a session-length entry.
//
// Deliberately NOT the same fix as the ownership helpers above having
// no SUPER_ADMIN bypass — that choice stays exactly as it was, on
// purpose. This is a narrower, different thing: VISIBILITY on list/GET
// routes only. A SUPER_ADMIN editing, deleting, or publishing someone
// else's course/exam/question is a materially more dangerous
// capability than a SUPER_ADMIN merely being ABLE TO SEE that it
// exists — granting the first as a side effect of fixing the second
// would be a real, unintended escalation, not a targeted fix. Every
// mutating route still goes through requireOwnedCourse/Module/Lesson/
// Material/Exam/Question exactly as before, completely unchanged.
//
// Use this only in a `where` clause on a list/GET query, never as a
// substitute for an ownership check on anything that modifies data.
export function createdByFilter(session: { userId: string; role: string }): { createdById: string } | undefined {
  return session.role === "SUPER_ADMIN" ? undefined : { createdById: session.userId };
}
