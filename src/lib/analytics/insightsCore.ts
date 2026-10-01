/**
 * Analytics System Phase 4 — the pure comparison math behind Automated
 * Insights, separated from insights.ts's Prisma orchestration for the
 * same testability reason every other `*Core.ts` file in this project
 * exists. These two guards (minimum baseline, minimum change magnitude)
 * are exactly where a real bug would most plausibly hide — Phase 3
 * found a real classification bug this way, not through unit tests
 * alone, which is why these are unit-tested directly here rather than
 * only exercised indirectly through the full insight-generation flow.
 */
export interface PeriodWindow {
  start: Date;
  end: Date;
}

/** Null means "undefined/meaningless" — never report a from-zero "infinite" change. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Whether a change is genuinely worth reporting: the PREVIOUS value must
 * clear a minimum baseline (so "1 last period, 0 this period" doesn't
 * read as a dramatic "-100%"), and the change itself must clear a
 * minimum magnitude (so normal day-to-day wobble doesn't get reported
 * as a story).
 */
export function meetsReportingThreshold(previousValue: number, change: number | null, minBaseline: number, minChangePercent: number): boolean {
  if (previousValue < minBaseline) return false;
  if (change === null) return false;
  return Math.abs(change) >= minChangePercent;
}

/** The current N-day window and the immediately-preceding window of the same length. */
export function computeComparisonWindows(days: number, now: Date): { current: PeriodWindow; previous: PeriodWindow } {
  const dayMs = 24 * 60 * 60 * 1000;
  const current = { start: new Date(now.getTime() - days * dayMs), end: now };
  const previous = { start: new Date(now.getTime() - 2 * days * dayMs), end: current.start };
  return { current, previous };
}
