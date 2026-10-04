/**
 * AI Assignment Engine — ownership checks, mirroring
 * courseOwnership.ts's requireOwnedCourse/createdByFilter exactly:
 * SUPER_ADMIN bypasses the owner check on mutations (consistent with
 * how course/module/lesson ownership already works), ADMIN/INSTRUCTOR
 * stay strictly scoped to assignments they created. Same 404-not-403
 * discipline — never confirm an assignment id exists but belongs to
 * someone else.
 *
 * Security note, stated here because this is the one file every
 * assignment route imports: `requireOwnedAssignment`'s `select`
 * deliberately includes `expectedAnswer`/`expectedConcepts`/`rubric`
 * on its questions ONLY because every call site is a STAFF route —
 * the equivalent trainee-facing lookups (in the API routes themselves)
 * use their own explicit student-safe `select`, never this function,
 * and never the full row.
 */
import { prisma } from "@/lib/prisma";

function notFound(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  return err;
}

export async function requireOwnedAssignment(assignmentId: string, userId: string, role?: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || (role !== "SUPER_ADMIN" && assignment.createdById !== userId)) {
    throw notFound("Assignment not found.");
  }
  return assignment;
}

export async function requireOwnedAssignmentQuestion(questionId: string, userId: string, role?: string) {
  const question = await prisma.assignmentQuestion.findUnique({
    where: { id: questionId },
    include: { assignment: true },
  });
  if (!question || (role !== "SUPER_ADMIN" && question.assignment.createdById !== userId)) {
    throw notFound("Question not found.");
  }
  return question;
}

/** Use only in a list/GET `where` clause — never as a mutation guard,
 * same discipline as courseOwnership.ts's own createdByFilter. */
export function assignmentCreatedByFilter(session: { userId: string; role: string }): { createdById: string } | undefined {
  return session.role === "SUPER_ADMIN" ? undefined : { createdById: session.userId };
}
