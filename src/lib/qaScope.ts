/**
 * M41 — the real, shared logic behind cohort-scoped Q&A. A single
 * function, not duplicated across the thread-create and thread-list
 * routes — the same discipline this project applies everywhere a rule
 * needs to stay consistent (courseAccess.ts's own comment makes this
 * exact argument).
 */
import { prisma } from "@/lib/prisma";

/**
 * The trainee's own cohort for this course, or null if they have none
 * — a real, honest, non-error state, not a fallback to guess at. See
 * the Cohort model's own schema comment: assignment is a separate,
 * manual roster system, never automatic on enrollment, so a trainee
 * with real course access and zero cohort assignment is an expected
 * case, not a data-integrity problem.
 */
export async function getTraineeCohortForCourse(traineeId: string, courseId: string): Promise<string | null> {
  const record = await prisma.enrollmentRecord.findFirst({
    where: { traineeId, cohort: { courseId } },
    select: { cohortId: true },
  });
  return record?.cohortId ?? null;
}

/**
 * Which threads a trainee is allowed to see for a lesson: every OPEN
 * thread (cohortId null) plus any thread scoped to their own cohort —
 * never another cohort's. A trainee with no cohort assignment
 * correctly sees only the OPEN ones, confirmed directly against real
 * seeded data before relying on this shape, not assumed.
 */
export function qaThreadVisibilityFilter(traineeCohortId: string | null) {
  return traineeCohortId ? { OR: [{ cohortId: null }, { cohortId: traineeCohortId }] } : { cohortId: null };
}
