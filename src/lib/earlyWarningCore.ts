/**
 * M38 — Staff Early-Warning Dashboard. Pure decision logic, no Prisma,
 * same pattern as progressCore.ts/examEngineCore.ts elsewhere in this
 * project — the actual "should this fire" reasoning is genuinely
 * testable without a database, so it's kept separate from the code
 * that reads/writes one.
 */

export function daysSince(from: Date | null, now: Date = new Date()): number | null {
  if (!from) return null;
  const ms = now.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Deliberately scoped: a trainee who has NEVER logged in at all
 * (lastLoginAt is null) is not considered "inactive" by this check —
 * that's a different problem (someone who registered but never
 * engaged, possibly still mid-verification) from "someone who was
 * active and has since gone quiet," which is what this milestone's
 * early-warning framing is actually about. Not an oversight; a
 * conscious scope line.
 */
export function isInactive(lastLoginAt: Date | null, thresholdDays: number | null, now: Date = new Date()): boolean {
  if (thresholdDays == null) return false; // feature disabled for this course
  const days = daysSince(lastLoginAt, now);
  if (days == null) return false;
  return days >= thresholdDays;
}

/**
 * INACTIVITY re-trigger rule: only fire again if the trainee logged in
 * again AFTER the last alert (meaning they genuinely came back) and
 * have since gone quiet again — never just because the same inactive
 * stretch is still ongoing and someone happened to check.
 */
export function shouldTriggerInactivityAlert(input: {
  currentlyInactive: boolean;
  existingAlertTriggeredAt: Date | null;
  lastLoginAt: Date | null;
}): boolean {
  if (!input.currentlyInactive) return false;
  if (!input.existingAlertTriggeredAt) return true; // first time crossing this threshold
  if (!input.lastLoginAt) return false; // never logged in — can't have "come back"
  return input.lastLoginAt.getTime() > input.existingAlertTriggeredAt.getTime();
}

/**
 * FAILED_ATTEMPTS re-trigger rule: only fire again if the trainee has
 * had a genuine passing attempt on this course since the last alert —
 * "something changed," the same reasoning as the inactivity rule
 * above, not "time passed" or "failed one more time."
 */
export function shouldTriggerFailedAttemptsAlert(input: {
  currentlyOverThreshold: boolean;
  existingAlertTriggeredAt: Date | null;
  hasPassedSinceLastAlert: boolean;
}): boolean {
  if (!input.currentlyOverThreshold) return false;
  if (!input.existingAlertTriggeredAt) return true;
  return input.hasPassedSinceLastAlert;
}
