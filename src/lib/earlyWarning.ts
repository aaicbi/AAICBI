/**
 * M38 — Staff Early-Warning Dashboard. The Prisma-touching layer
 * around earlyWarningCore.ts's pure decision functions — real
 * queries, race-safe alert creation, and the actual notification
 * sends. Kept separate from the core module on purpose, same
 * reasoning as examEngine.ts vs examEngineCore.ts elsewhere in this
 * project.
 *
 * Correction from the original build: FAILED_ATTEMPTS is scoped per
 * MODULE ASSESSMENT (per Exam), not cumulative across a whole course
 * — "3 failed attempts" means 3 on one specific assessment, not 3
 * combined across every assessment in the course. See
 * InactivityAlert/FailedAttemptsAlert's own schema comments for the
 * full reasoning, including why this needed two separate models
 * rather than one shared one.
 */
import { prisma } from "@/lib/prisma";
import { isInactive, shouldTriggerInactivityAlert, shouldTriggerFailedAttemptsAlert } from "@/lib/earlyWarningCore";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { earlyWarningStaffEmail, earlyWarningTraineeEmail } from "@/lib/notifications/templates";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/** A simple, total count of this trainee's failed attempts on this
 * ONE exam — not a rolling window, not combined across the course. */
async function countFailedAttempts(traineeId: string, examId: string): Promise<number> {
  return prisma.attempt.count({ where: { traineeId, examId, passed: false } });
}

/** The real query behind shouldTriggerFailedAttemptsAlert's
 * `hasPassedSinceLastAlert` input — has this trainee had a genuine
 * passing attempt on this SAME exam since the given timestamp. */
async function hasPassedSince(traineeId: string, examId: string, since: Date): Promise<boolean> {
  const passing = await prisma.attempt.findFirst({
    where: { traineeId, examId, passed: true, submittedAt: { gt: since } },
    select: { id: true },
  });
  return passing !== null;
}

/** Race-safe alert creation — same individual-create-plus-caught-P2002
 * pattern already used in progress.ts for module completions. Returns
 * true only if THIS call is the one that actually created/updated the
 * row — the exact "it's my job to notify" signal a bulk upsert can't
 * give as precisely, though upsert itself is what's used here since,
 * unlike a pure create, a genuine re-trigger needs to refresh
 * triggeredAt on an existing row, not just insert a fresh one. */
async function tryUpsertInactivityAlert(traineeId: string, courseId: string): Promise<boolean> {
  try {
    await prisma.inactivityAlert.upsert({
      where: { traineeId_courseId: { traineeId, courseId } },
      create: { traineeId, courseId },
      update: { triggeredAt: new Date() },
    });
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code !== "P2002") throw e;
    return false;
  }
}

async function tryUpsertFailedAttemptsAlert(traineeId: string, examId: string): Promise<boolean> {
  try {
    await prisma.failedAttemptsAlert.upsert({
      where: { traineeId_examId: { traineeId, examId } },
      create: { traineeId, examId },
      update: { triggeredAt: new Date() },
    });
    return true;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code !== "P2002") throw e;
    return false;
  }
}

/**
 * FAILED_ATTEMPTS check — genuinely real-time. Called from
 * examEngine.ts's submitAttempt the moment a failing attempt is
 * graded, scoped to the specific exam that was just attempted, not
 * the whole course it belongs to.
 */
export async function checkFailedAttemptsThreshold(traineeId: string, examId: string, courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, failedAttemptsThreshold: true, createdBy: { select: { email: true } } },
  });
  if (!course || course.failedAttemptsThreshold == null) return; // feature disabled for this course

  const [failedCount, existingAlert] = await Promise.all([
    countFailedAttempts(traineeId, examId),
    prisma.failedAttemptsAlert.findUnique({ where: { traineeId_examId: { traineeId, examId } } }),
  ]);

  const currentlyOverThreshold = failedCount >= course.failedAttemptsThreshold;
  const hasPassedSinceLastAlert = existingAlert ? await hasPassedSince(traineeId, examId, existingAlert.triggeredAt) : false;

  const shouldFire = shouldTriggerFailedAttemptsAlert({
    currentlyOverThreshold,
    existingAlertTriggeredAt: existingAlert?.triggeredAt ?? null,
    hasPassedSinceLastAlert,
  });
  if (!shouldFire) return;

  const won = await tryUpsertFailedAttemptsAlert(traineeId, examId);
  if (!won) return;

  await sendAlertNotifications(traineeId, courseId, course.title, course.createdBy?.email ?? null, "failed-attempts", `has now failed ${failedCount} attempts on one module's assessment`);
}

/**
 * INACTIVITY check — honestly NOT real-time (see InactivityAlert's own
 * schema comment for why: no background job infrastructure exists in
 * this project, on purpose). Called from the staff dashboard's own
 * load — the next natural touchpoint, not the instant N days elapse.
 */
export async function checkInactivityForCourse(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, inactivityThresholdDays: true, createdBy: { select: { email: true } } },
  });
  if (!course || course.inactivityThresholdDays == null) return;

  // Performance fix: filter at the database level rather than fetching
  // every enrolled trainee and discarding most of them in JavaScript.
  // In a healthy course, most trainees are NOT inactive at any given
  // moment — fetching only the ones already past the cutoff date means
  // this loop's real cost scales with how many trainees are actually
  // struggling, not with total enrollment. `lt: cutoffDate` naturally
  // excludes a null lastLoginAt too (SQL NULL < anything is never
  // true), preserving the exact same "never logged in isn't flagged"
  // behavior isInactive() already establishes — this is a pre-filter,
  // not a replacement for it; isInactive() is still the actual
  // decision inside the loop below, this just avoids doing that check
  // for trainees who obviously don't need it.
  const cutoffDate = new Date(Date.now() - course.inactivityThresholdDays * 24 * 60 * 60 * 1000);
  const enrollments = await prisma.courseEnrollment.findMany({
    where: {
      courseId,
      unlockedAt: { not: null },
      accessRevokedAt: null,
      trainee: { lastLoginAt: { lt: cutoffDate } },
    },
    select: { trainee: { select: { id: true, lastLoginAt: true } } },
  });

  for (const { trainee } of enrollments) {
    // M38 hardening — one trainee's check failing (a bad row, a
    // transient DB hiccup) must never stop the rest of the course's
    // trainees from being checked. Each iteration is independently
    // safe, the same "wrapped, never allowed to propagate" discipline
    // already used for every other notification trigger site in this
    // project.
    try {
      const currentlyInactive = isInactive(trainee.lastLoginAt, course.inactivityThresholdDays);
      if (!currentlyInactive) continue;

      const existingAlert = await prisma.inactivityAlert.findUnique({
        where: { traineeId_courseId: { traineeId: trainee.id, courseId } },
      });

      const shouldFire = shouldTriggerInactivityAlert({
        currentlyInactive,
        existingAlertTriggeredAt: existingAlert?.triggeredAt ?? null,
        lastLoginAt: trainee.lastLoginAt,
      });
      if (!shouldFire) continue;

      const won = await tryUpsertInactivityAlert(trainee.id, courseId);
      if (!won) continue;

      const days = Math.floor((Date.now() - (trainee.lastLoginAt as Date).getTime()) / (1000 * 60 * 60 * 24));
      await sendAlertNotifications(trainee.id, courseId, course.title, course.createdBy?.email ?? null, "inactivity", `hasn't logged in for ${days} days`);
    } catch (e) {
      console.error(`Early-warning inactivity check failed for trainee ${trainee.id} in course ${courseId}:`, e);
    }
  }
}

async function sendAlertNotifications(
  traineeId: string,
  courseId: string,
  courseTitle: string,
  staffEmail: string | null,
  reason: "inactivity" | "failed-attempts",
  staffDetail: string
): Promise<void> {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: { name: true, email: true, notificationsEnabled: true },
  });
  if (!trainee) return;

  const dashboardUrl = `${APP_URL}/admin/courses/${courseId}/early-warnings`;
  const courseUrl = `${APP_URL}/trainee/courses/${courseId}`;
  const relativeDashboardUrl = `/admin/courses/${courseId}/early-warnings`;
  const relativeCourseUrl = `/trainee/courses/${courseId}`;

  // Never let a failed/slow send affect anything else — same
  // "wrapped, never allowed to propagate" discipline already used for
  // every other notification trigger site in this project.
  if (staffEmail) {
    const staffContent = earlyWarningStaffEmail({ traineeName: trainee.name, courseTitle, reason, detail: staffDetail, dashboardUrl });
    await notifyByEmail({
      recipientType: "STAFF",
      recipientId: courseId,
      to: staffEmail,
      type: "EARLY_WARNING_STAFF",
      relatedId: traineeId,
      // Same audit sweep as elsewhere — click takes staff to the
      // course's early-warnings dashboard.
      url: relativeDashboardUrl,
      ...staffContent,
    }).catch(() => {});
  }

  if (shouldNotifyTrainee(trainee)) {
    const traineeContent = earlyWarningTraineeEmail({ traineeName: trainee.name, courseTitle, courseUrl, reason });
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: trainee.email,
      type: "EARLY_WARNING_TRAINEE",
      // Click takes the trainee back to the course this concerns.
      url: relativeCourseUrl,
      relatedId: courseId,
      ...traineeContent,
    }).catch(() => {});
  }
}
