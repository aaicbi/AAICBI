/**
 * M18 — Course Access Control. The one function every trainee-facing
 * route under a course should use, rather than each writing its own
 * ad-hoc enrollment check — the roadmap's own warning about this
 * milestone is that the real risk isn't any one route being wrong,
 * it's missing one entirely, and a shared function makes "missing
 * one" mean "forgot to call this," not "wrote the check slightly
 * differently and got it wrong."
 */
import { prisma } from "@/lib/prisma";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { subscriptionEndedEmail } from "@/lib/notifications/templates";

/** True only when a real, unlocked, non-revoked CourseEnrollment row
 * exists for this trainee and course — the exact same condition
 * `checkInactivityForCourse` (M38) already uses to decide who counts
 * as "really" enrolled, not a new, separately-invented definition. */
export async function hasCourseAccess(traineeId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { traineeId, courseId, unlockedAt: { not: null }, accessRevokedAt: null },
    select: { id: true },
  });
  return enrollment !== null;
}

/** Throws a 403 if the trainee doesn't have access — deliberately
 * 403, not 404. Courses are publicly browsable (title, description,
 * whether it's free or paid) by design; only the actual content is
 * gated. A trainee without access should see "you're not enrolled,"
 * not be told the course doesn't exist, which would be actively
 * unhelpful for someone trying to figure out how to enroll. */
export async function requireCourseAccess(traineeId: string, courseId: string): Promise<void> {
  const access = await hasCourseAccess(traineeId, courseId);
  if (!access) {
    const err = new Error("You're not enrolled in this course yet.") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

/**
 * Course enrollment/subscription system — the lazy, per-trainee half of
 * expiry processing, same "check on next touchpoint" shape as
 * examEngine.ts's expireStaleAttemptsForTrainee. `hasCourseAccess`
 * itself is deliberately left untouched (see this milestone's plan):
 * it already only grants access to a row with `accessRevokedAt: null`,
 * so a lapsed subscription genuinely does lose access the moment
 * something calls this function — the only gap is that nothing
 * previously called it. A trainee who never revisits the app between
 * their expiry and their next real page load isn't covered by this
 * alone — see the Vercel Cron sweep (Phase 6) for the safety net that
 * doesn't depend on a visit at all, and the only real expiry mechanism
 * for FIXED_DURATION courses, which have no Paystack webhook to revoke
 * them.
 *
 * Revokes at the enrollment's own `currentPeriodEnd`, not `now` — an
 * honest timestamp of when access actually lapsed, not when this
 * happened to run. A null `currentPeriodEnd` means lifetime access and
 * is always excluded.
 */
async function expireLapsedEnrollments(scopeTraineeId?: string): Promise<number> {
  const lapsed = await prisma.courseEnrollment.findMany({
    where: {
      ...(scopeTraineeId ? { traineeId: scopeTraineeId } : {}),
      accessRevokedAt: null,
      unlockedAt: { not: null },
      currentPeriodEnd: { lt: new Date() },
    },
    select: { id: true, traineeId: true, courseId: true, currentPeriodEnd: true },
  });

  for (const enrollment of lapsed) {
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { accessRevokedAt: enrollment.currentPeriodEnd },
    });

    const [trainee, course] = await Promise.all([
      prisma.trainee.findUnique({ where: { id: enrollment.traineeId } }),
      prisma.course.findUnique({ where: { id: enrollment.courseId }, select: { title: true } }),
    ]);
    if (trainee && course && shouldNotifyTrainee(trainee)) {
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const relativeUrl = `/trainee/courses/${enrollment.courseId}`;
      const content = subscriptionEndedEmail({
        traineeName: trainee.name,
        courseTitle: course.title,
        courseUrl: `${appUrl}${relativeUrl}`,
      });
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: enrollment.traineeId,
        to: trainee.email,
        type: "SUBSCRIPTION_ENDED",
        relatedId: enrollment.courseId,
        url: relativeUrl,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }).catch((e) => console.error(`Failed to send access-expired email for trainee ${enrollment.traineeId}, course ${enrollment.courseId}:`, e));
    }
  }
  return lapsed.length;
}

export async function expireLapsedEnrollmentsForTrainee(traineeId: string): Promise<void> {
  await expireLapsedEnrollments(traineeId);
}

/**
 * Course enrollment/subscription system — the unscoped counterpart
 * called by the Vercel Cron sweep (Phase 6), same shared
 * `expireLapsedEnrollments` body as the per-trainee version above, just
 * without a `traineeId` filter. This is the ONLY expiry mechanism that
 * doesn't depend on the affected trainee (or anyone) visiting the app
 * at all — the real safety net for a trainee who never comes back, and
 * the only expiry mechanism at all for FIXED_DURATION courses, which
 * have no Paystack webhook to revoke them. Returns the count revoked,
 * for the cron route's own response body.
 */
export async function expireAllLapsedEnrollments(): Promise<number> {
  return expireLapsedEnrollments();
}

export type EnrollmentStatus = "ACTIVE" | "EXPIRED" | "COMPLETED" | "AWAITING_UNLOCK";

/**
 * Course enrollment/subscription system — derived, not stored (see the
 * plan's own reasoning: a stored status kept in sync at 6+ write sites
 * risks drift; this is computed fresh every time from fields that are
 * each already an authoritative, independently-written fact).
 * `completedAt` wins even over a later access lapse — a trainee who
 * finished the course keeps that as a historical fact regardless of
 * whether they later let their subscription expire, the same
 * "historical fact, never re-derived" treatment this schema already
 * gives Attempt.passed and ModuleCompletion.
 *
 * `AWAITING_UNLOCK` covers a real, distinct state this schema already
 * has: a paid CourseEnrollment row created by processConfirmedCharge
 * but not yet unlocked — the trainee has an email with their OTP
 * sitting in it, but `hasCourseAccess` correctly returns false for
 * them until they actually enter it. Mislabeling this ACTIVE would be
 * wrong; mislabeling it EXPIRED would be actively misleading (nothing
 * has lapsed — it hasn't started yet).
 */
export function deriveEnrollmentStatus(enrollment: {
  completedAt: Date | null;
  accessRevokedAt: Date | null;
  unlockedAt: Date | null;
}): EnrollmentStatus {
  if (enrollment.completedAt) return "COMPLETED";
  if (enrollment.accessRevokedAt) return "EXPIRED";
  if (!enrollment.unlockedAt) return "AWAITING_UNLOCK";
  return "ACTIVE";
}
