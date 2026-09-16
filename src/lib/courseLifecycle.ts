/**
 * Coming Soon Courses — the single source of truth for "where is this
 * scheduled course in its own pre/post-launch timeline," a strictly
 * separate concern from `courseStatus.ts`'s "is this course publicly
 * visible at all." A course keeps its normal `status` gate unchanged;
 * this only ever matters for a course that's already PUBLISHED and has
 * a `startDate` set.
 *
 * Deliberately a pure function of `now` vs. the course's own dates —
 * not a stored, cron-swept enum the way `JobPosting.status` is (see
 * jobPostingExpiry.ts). Every input this needs is already available
 * wherever the phase is checked, so there's no staleness window to
 * correct and nothing to add to the existing course-access-sweep cron.
 */
import type { CourseLifecyclePhase } from "@prisma/client";

export interface ScheduleFields {
  startDate: Date | string | null;
  endDate?: Date | string | null;
  registrationDeadline?: Date | string | null;
  lifecyclePhaseOverride?: CourseLifecyclePhase | null;
}

/**
 * `null` means "not a scheduled course at all" — no `startDate` was
 * ever set, so nothing about this feature applies. Every caller must
 * treat `null` as "behave exactly as before this feature existed,"
 * which is what makes this 100% backward-compatible with every course
 * that predates it, with no migration backfill or feature flag needed.
 */
export function getCourseLifecyclePhase(course: ScheduleFields): CourseLifecyclePhase | null {
  if (!course.startDate) return null;
  if (course.lifecyclePhaseOverride) return course.lifecyclePhaseOverride;

  const now = Date.now();
  const startDate = new Date(course.startDate).getTime();
  const endDate = course.endDate ? new Date(course.endDate).getTime() : null;
  const registrationDeadline = course.registrationDeadline ? new Date(course.registrationDeadline).getTime() : null;

  if (endDate != null && now >= endDate) return "COMPLETED";
  if (now >= startDate) return "STARTED";
  // Between registrationDeadline and startDate — registration has
  // closed but the course hasn't started yet.
  if (registrationDeadline != null && now >= registrationDeadline) return "REGISTRATION_CLOSED";
  // A startDate is set but registrationDeadline isn't yet — the admin
  // has scheduled the course but hasn't opened registration.
  if (registrationDeadline == null) return "COMING_SOON";
  return "REGISTRATION_OPEN";
}

/**
 * The one function the enroll/pay guards actually call — they never
 * need to know the phase enum's internals. Returns `true` for an
 * ordinary, non-scheduled course (phase `null`), so this guard can
 * never block a course that predates this feature.
 */
export function isRegistrationOpen(course: ScheduleFields): boolean {
  const phase = getCourseLifecyclePhase(course);
  return phase === null || phase === "REGISTRATION_OPEN";
}

export const COURSE_LIFECYCLE_PHASE_LABEL: Record<CourseLifecyclePhase, string> = {
  COMING_SOON: "Coming Soon",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  STARTED: "Started",
  COMPLETED: "Completed",
};

export const COURSE_LIFECYCLE_PHASE_BADGE_VARIANT: Record<CourseLifecyclePhase, "success" | "warning" | "danger" | "neutral" | "gold"> = {
  COMING_SOON: "gold",
  REGISTRATION_OPEN: "success",
  REGISTRATION_CLOSED: "warning",
  STARTED: "neutral",
  COMPLETED: "danger",
};

export const COURSE_LIFECYCLE_PHASE_VALUES: CourseLifecyclePhase[] = [
  "COMING_SOON",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "STARTED",
  "COMPLETED",
];
