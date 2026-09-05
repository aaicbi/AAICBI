/**
 * M22 — the retake-cooldown decision logic, pure and testable, same
 * pattern as earlyWarningCore.ts elsewhere in this project. An
 * override only ever counts if it was granted AFTER the attempt that
 * triggered the cooldown being checked — this is what gives a granted
 * override genuinely one-time semantics without needing to explicitly
 * "consume" or delete it: a later attempt establishes a new cooldown
 * anchor, and that same override (with its now-earlier grantedAt)
 * naturally stops applying to it.
 */

/** Returns the Date the trainee can attempt again, or null if they
 * can attempt right now. `lastAttemptSubmittedAt` is null when there's
 * no previous attempt at all — nothing to be in cooldown from. */
export function nextAttemptAllowedAt(
  retakeCooldownHours: number | null,
  lastAttemptSubmittedAt: Date | null,
  overrideGrantedAt: Date | null,
  now: Date = new Date()
): Date | null {
  if (retakeCooldownHours == null) return null; // no cooldown configured for this exam
  if (lastAttemptSubmittedAt == null) return null; // first attempt — nothing to cool down from

  if (overrideGrantedAt && overrideGrantedAt.getTime() > lastAttemptSubmittedAt.getTime()) {
    return null; // a staff override granted after this attempt bypasses its cooldown
  }

  const cooldownEndsAt = new Date(lastAttemptSubmittedAt.getTime() + retakeCooldownHours * 60 * 60 * 1000);
  if (now.getTime() >= cooldownEndsAt.getTime()) return null; // cooldown has already passed naturally
  return cooldownEndsAt;
}
