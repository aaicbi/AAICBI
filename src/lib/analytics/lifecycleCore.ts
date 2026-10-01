/**
 * Analytics System Phase 1 — a simple, transparent, rule-based lifecycle
 * tag per trainee (task Section 14). Deliberately NOT the full weighted/
 * decayed engagement-scoring engine the master spec's Section 13/30
 * describe — that's a later-phase addition once this simpler version
 * has proven useful. Pure function (no Prisma, no I/O) so it's testable
 * the same way every other `*Core.ts` file in this project is, and so
 * the thresholds are transparent, named constants an admin could point
 * to, not an opaque score.
 */
export type LifecycleTag = "NEW" | "ACTIVE" | "INACTIVE" | "COMPLETER";

export const NEW_WITHIN_DAYS = 7;
export const INACTIVE_AFTER_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function classifyLifecycle(
  trainee: { createdAt: Date; lastLoginAt: Date | null },
  hasCompletedAnyCourse: boolean,
  now: Date = new Date()
): LifecycleTag {
  // A trainee who has ever finished a course is always a COMPLETER —
  // takes priority over NEW/INACTIVE since it's the strongest, most
  // durable signal: someone who already proved out the platform once,
  // even if they haven't logged in recently.
  if (hasCompletedAnyCourse) return "COMPLETER";

  const daysSinceCreated = (now.getTime() - trainee.createdAt.getTime()) / MS_PER_DAY;
  if (daysSinceCreated <= NEW_WITHIN_DAYS) return "NEW";

  const daysSinceLogin = trainee.lastLoginAt ? (now.getTime() - trainee.lastLoginAt.getTime()) / MS_PER_DAY : Infinity;
  if (daysSinceLogin > INACTIVE_AFTER_DAYS) return "INACTIVE";

  return "ACTIVE";
}
