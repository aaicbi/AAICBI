/**
 * Analytics System Phase 3 — a single registration-cohort summary
 * table (group by week registered, show size/active/completion), not
 * the full N-weeks-since-joining retention matrix the master spec
 * sketches — a deliberate, stated trim; see the Phase 3 plan's own
 * reasoning. Acquisition-source attribution per cohort only works for
 * trainees whose `registrationVisitorId` was captured (i.e., who had
 * already accepted cookie tracking pre-signup) — everyone else
 * contributes to a cohort's size/engagement numbers but not its
 * "top source" breakdown.
 */
import { prisma } from "@/lib/prisma";
import { classifyLifecycle } from "@/lib/analytics/lifecycleCore";

export interface CohortRow {
  weekStart: string; // YYYY-MM-DD, Monday of the registration week
  size: number;
  activeCount: number;
  completedCount: number;
  completionRate: number | null;
  topReferrerSource: string | null;
}

function startOfWeekUTC(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

export async function getRegistrationCohorts(weeksBack: number = 8, now: Date = new Date()): Promise<CohortRow[]> {
  const since = new Date(now.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000);

  const [trainees, enrollments] = await Promise.all([
    prisma.trainee.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, createdAt: true, lastLoginAt: true, registrationVisitorId: true },
    }),
    prisma.courseEnrollment.findMany({ select: { traineeId: true, completedAt: true } }),
  ]);
  const completedTraineeIds = new Set(enrollments.filter((e) => e.completedAt).map((e) => e.traineeId));

  const visitorIds = trainees.map((t) => t.registrationVisitorId).filter((v): v is string => !!v);
  const earliestEventByVisitor = new Map<string, string | null>();
  if (visitorIds.length > 0) {
    const events = await prisma.visitorEvent.findMany({
      where: { visitorId: { in: visitorIds } },
      select: { visitorId: true, referrerSource: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      distinct: ["visitorId"],
    });
    for (const e of events) earliestEventByVisitor.set(e.visitorId, e.referrerSource);
  }

  const byWeek = new Map<
    string,
    { size: number; activeCount: number; completedCount: number; sourceCounts: Map<string, number> }
  >();

  for (const trainee of trainees) {
    const week = startOfWeekUTC(trainee.createdAt);
    const entry = byWeek.get(week) ?? { size: 0, activeCount: 0, completedCount: 0, sourceCounts: new Map() };
    entry.size++;

    const hasCompleted = completedTraineeIds.has(trainee.id);
    if (hasCompleted) entry.completedCount++;
    if (classifyLifecycle(trainee, hasCompleted, now) === "ACTIVE") entry.activeCount++;

    const source = trainee.registrationVisitorId ? earliestEventByVisitor.get(trainee.registrationVisitorId) : null;
    if (source) entry.sourceCounts.set(source, (entry.sourceCounts.get(source) ?? 0) + 1);

    byWeek.set(week, entry);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => b.localeCompare(a)) // most recent cohort first
    .map(([weekStart, v]) => {
      let topReferrerSource: string | null = null;
      let topCount = 0;
      for (const [source, count] of v.sourceCounts) {
        if (count > topCount) {
          topReferrerSource = source;
          topCount = count;
        }
      }
      return {
        weekStart,
        size: v.size,
        activeCount: v.activeCount,
        completedCount: v.completedCount,
        completionRate: v.size > 0 ? Math.round((v.completedCount / v.size) * 1000) / 10 : null,
        topReferrerSource,
      };
    });
}
