/**
 * Analytics System Phase 1 — "current learning streak" for a trainee's
 * personal activity view (task Section 24). Pure function: takes the
 * raw activity timestamps and today's date, returns a day count. Today
 * not yet having activity doesn't break the streak — the day isn't
 * over yet — so counting starts from yesterday in that case; today
 * genuinely having no activity AND yesterday having none means the
 * streak is 0, not a stale leftover number.
 */
export function computeStreakDays(activityDates: Date[], now: Date = new Date()): number {
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const days = new Set(activityDates.map(dayKey));
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - ONE_DAY_MS);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - ONE_DAY_MS);
  }
  return streak;
}
