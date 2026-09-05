import { prisma } from "@/lib/prisma";

/**
 * M11 audit finding: `Attempt.exam` and `Answer.question` were never
 * given an `onDelete` clause (see the comments on those fields in
 * schema.prisma), which — with no application-level check anywhere —
 * meant deleting a Module with an attempted assessment, or a Question
 * any trainee had ever answered, threw a raw, unhandled Postgres
 * foreign-key-violation straight through `withApiErrors` as a generic
 * 500. The underlying database behavior is correct and deliberately
 * kept (a trainee's real performance data should never silently vanish
 * because staff deleted the content it was recorded against) — what
 * was missing was telling the admin *why* before they ever hit it.
 *
 * These two functions are the "why": called at the top of the relevant
 * DELETE routes, before the delete itself, so the person gets a clear,
 * specific 409 instead of a confusing 500 with a raw Postgres error
 * message. Deliberately not offering a "force delete" escape hatch
 * here — that's a real feature (with its own confirmation UX) worth
 * designing properly later, not something to bolt on as a side effect
 * of fixing an error message.
 */
function conflict(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 409;
  return err;
}

/** Throws if the given exam has any recorded attempts. Call before
 * deleting an Exam directly, or before deleting a Module whose
 * assessment (if any) might have attempts under it. */
export async function guardExamDeletable(examId: string): Promise<void> {
  const attemptCount = await prisma.attempt.count({ where: { examId } });
  if (attemptCount > 0) {
    throw conflict(
      `Can't delete this — ${attemptCount} trainee attempt${attemptCount === 1 ? " has" : "s have"} already been recorded against it. ` +
        `Deleting it would destroy real trainee performance data, so this is blocked rather than done silently.`
    );
  }
}

/** Module-specific wrapper: only guards if the module actually has an
 * assessment — a module with no Exam row yet has nothing to protect. */
export async function guardModuleDeletable(moduleId: string): Promise<void> {
  const exam = await prisma.exam.findUnique({ where: { moduleId }, select: { id: true } });
  if (exam) await guardExamDeletable(exam.id);
}

/** Course-specific wrapper: a course delete cascades through every one
 * of its modules (Module.course is onDelete: Cascade), and each of
 * THOSE modules' assessments (Exam.courseModule is also Cascade) — so
 * a course with even one module whose assessment has attempts hits the
 * exact same Attempt.exam Restrict constraint as deleting that module
 * directly would, just one level further up. Checked in one query
 * across every module under the course, not module-by-module, so the
 * error reports a real total rather than stopping at the first one
 * found.
 *
 * M15: also checks for issued certificates, same reasoning as the
 * attempt check — a trainee's earned credential (Certificate.course is
 * onDelete: Restrict, see the schema comment on Certificate) must
 * never be silently invalidated by deleting the course it was earned
 * on, and deserves its own clear message rather than surfacing as the
 * same generic "trainee attempts exist" one. */
export async function guardCourseDeletable(courseId: string): Promise<void> {
  const certificateCount = await prisma.certificate.count({ where: { courseId } });
  if (certificateCount > 0) {
    throw conflict(
      `Can't delete this course — ${certificateCount} certificate${certificateCount === 1 ? " has" : "s have"} already been issued for it. ` +
        `Deleting it would invalidate real, earned trainee credentials, so this is blocked rather than done silently.`
    );
  }

  // Post-M15 milestone audit finding: a course with real, currently-
  // paying subscribers could be deleted with no warning at all before
  // this check existed — CourseEnrollment cascades with its course by
  // design (see that model's own comment, it's the right call for
  // FREE/ADMIN_GRANTED access records), but a PAID enrollment isn't
  // just an access record, it's a live Paystack subscription. Deleting
  // it here would destroy the only record that subscription exists —
  // Paystack would keep charging the trainee's card every month with
  // nothing left in this app to ever go cancel it. Checked the same
  // way certificates are: a real thing that blocks deletion, not
  // something that quietly cascades away.
  const activePaidEnrollmentCount = await prisma.courseEnrollment.count({
    where: { courseId, source: "PAID", accessRevokedAt: null },
  });
  if (activePaidEnrollmentCount > 0) {
    throw conflict(
      `Can't delete this course — ${activePaidEnrollmentCount} trainee${activePaidEnrollmentCount === 1 ? " has" : "s have"} an active paid subscription to it. ` +
        `Deleting it would orphan a live Paystack subscription with no record left to ever cancel it — cancel each subscription first, then delete the course.`
    );
  }

  const modules = await prisma.module.findMany({ where: { courseId }, select: { id: true } });
  if (modules.length === 0) return;

  const exams = await prisma.exam.findMany({
    where: { moduleId: { in: modules.map((m: { id: string }) => m.id) } },
    select: { id: true },
  });
  if (exams.length === 0) return;

  const attemptCount = await prisma.attempt.count({
    where: { examId: { in: exams.map((e: { id: string }) => e.id) } },
  });
  if (attemptCount > 0) {
    throw conflict(
      `Can't delete this course — ${attemptCount} trainee attempt${attemptCount === 1 ? " has" : "s have"} already been recorded across its modules' assessments. ` +
        `Deleting it would destroy real trainee performance data, so this is blocked rather than done silently.`
    );
  }
}

/** Throws if the given question has any recorded answers. */
export async function guardQuestionDeletable(questionId: string): Promise<void> {
  const answerCount = await prisma.answer.count({ where: { questionId } });
  if (answerCount > 0) {
    throw conflict(
      `Can't delete this — ${answerCount} trainee answer${answerCount === 1 ? " has" : "s have"} already been recorded against it. ` +
        `If it needs correcting, edit it instead of deleting it.`
    );
  }
}
