/**
 * Analytics System Phase 4 — "Automated Insights" (master spec Section
 * 17). Compares the current N-day window against the immediately-
 * preceding window of the same length, reusing Phase 1-3's own
 * aggregation functions for both windows rather than any new
 * aggregation logic — this file is purely the Prisma orchestration;
 * the actual comparison math lives in insightsCore.ts, pure and
 * directly unit-tested.
 *
 * Every `summary` is phrased as an observed change, never a causal
 * claim — same discipline `/admin/analytics`'s funnel section already
 * states explicitly ("a behavioural association, not a causal claim").
 */
import { getPlatformOverview, getCoursePerformance } from "@/lib/analytics/aggregate";
import { getPlatformInterestSummary } from "@/lib/analytics/interestScoring";
import { pctChange, meetsReportingThreshold, computeComparisonWindows } from "@/lib/analytics/insightsCore";

export type InsightType = "REGISTRATIONS" | "ENROLLMENTS" | "CONVERSION_RATE" | "TOP_COURSE_GROWTH" | "EMERGING_INTEREST";

export interface Insight {
  type: InsightType;
  summary: string;
  evidence: Record<string, number | string>;
}

// Named constants, not admin-tunable — same trim as every prior phase's
// thresholds (lifecycleCore.ts, interestScoring.ts's weights).
const MIN_CHANGE_PERCENT = 15;
const MIN_BASELINE = 5;
const MIN_COURSE_INTERACTION_BASELINE = 3;

export async function getAutomatedInsights(days: number = 30, now: Date = new Date()): Promise<Insight[]> {
  const { current, previous } = computeComparisonWindows(days, now);
  const insights: Insight[] = [];

  const [overviewCurrent, overviewPrevious, coursesCurrent, coursesPrevious, interestSummary] = await Promise.all([
    getPlatformOverview(current),
    getPlatformOverview(previous),
    getCoursePerformance(current),
    getCoursePerformance(previous),
    getPlatformInterestSummary(now),
  ]);

  // REGISTRATIONS
  if (overviewPrevious.newRegistrations !== null && overviewCurrent.newRegistrations !== null) {
    const change = pctChange(overviewCurrent.newRegistrations, overviewPrevious.newRegistrations);
    if (meetsReportingThreshold(overviewPrevious.newRegistrations, change, MIN_BASELINE, MIN_CHANGE_PERCENT)) {
      insights.push({
        type: "REGISTRATIONS",
        summary: `Registrations ${change! > 0 ? "increased" : "decreased"} by ${Math.abs(change!)}% compared with the previous ${days}-day period.`,
        evidence: { current: overviewCurrent.newRegistrations, previous: overviewPrevious.newRegistrations, changePercent: change! },
      });
    }
  }

  // ENROLLMENTS
  {
    const change = pctChange(overviewCurrent.enrollments, overviewPrevious.enrollments);
    if (meetsReportingThreshold(overviewPrevious.enrollments, change, MIN_BASELINE, MIN_CHANGE_PERCENT)) {
      insights.push({
        type: "ENROLLMENTS",
        summary: `Enrollments ${change! > 0 ? "increased" : "decreased"} by ${Math.abs(change!)}% compared with the previous ${days}-day period.`,
        evidence: { current: overviewCurrent.enrollments, previous: overviewPrevious.enrollments, changePercent: change! },
      });
    }
  }

  // CONVERSION_RATE — a percentage-POINT change, not a relative % change
  // of a rate (more honest: "42% to 55%" reads as "+13 points," not a
  // confusing "+31%"). Still gated on the ENROLLMENTS baseline — a
  // conversion rate computed from a handful of enrollments is noise.
  if (overviewPrevious.conversionRate !== null && overviewCurrent.conversionRate !== null && overviewPrevious.enrollments >= MIN_BASELINE) {
    const pointChange = Math.round((overviewCurrent.conversionRate - overviewPrevious.conversionRate) * 10) / 10;
    if (Math.abs(pointChange) >= MIN_CHANGE_PERCENT) {
      insights.push({
        type: "CONVERSION_RATE",
        summary: `The enrollment-to-completion conversion rate ${pointChange > 0 ? "rose" : "fell"} by ${Math.abs(pointChange)} percentage points compared with the previous ${days}-day period.`,
        evidence: { current: overviewCurrent.conversionRate, previous: overviewPrevious.conversionRate, pointChange },
      });
    }
  }

  // TOP_COURSE_GROWTH — the single course with the largest % growth in
  // total interaction (authenticated + anonymous views), among courses
  // with a real previous-period baseline.
  const previousByCourseId = new Map(coursesPrevious.map((c) => [c.courseId, c]));
  let bestGrowth: { title: string; change: number; current: number; previous: number } | null = null;
  for (const course of coursesCurrent) {
    const prior = previousByCourseId.get(course.courseId);
    const priorInteraction = (prior?.views ?? 0) + (prior?.anonymousViews ?? 0);
    const currentInteraction = course.views + course.anonymousViews;
    const change = pctChange(currentInteraction, priorInteraction);
    if (
      meetsReportingThreshold(priorInteraction, change, MIN_COURSE_INTERACTION_BASELINE, MIN_CHANGE_PERCENT) &&
      change! > 0 &&
      (bestGrowth === null || change! > bestGrowth.change)
    ) {
      bestGrowth = { title: course.title, change: change!, current: currentInteraction, previous: priorInteraction };
    }
  }
  if (bestGrowth) {
    insights.push({
      type: "TOP_COURSE_GROWTH",
      summary: `"${bestGrowth.title}" received ${bestGrowth.change}% more interaction (views) compared with the previous ${days}-day period.`,
      evidence: { course: bestGrowth.title, current: bestGrowth.current, previous: bestGrowth.previous, changePercent: bestGrowth.change },
    });
  }

  // EMERGING_INTEREST — a direct fact, not a period-diff (interest
  // scores are decayed-cumulative, not period-bucketed, so "emerging"
  // already encodes recency on its own — see interestCore.ts).
  if (interestSummary.emergingTopics.length > 0) {
    const topics = interestSummary.emergingTopics.slice(0, 3).map((t) => t.topic);
    insights.push({
      type: "EMERGING_INTEREST",
      summary: `${topics.join(", ")} ${topics.length === 1 ? "is" : "are"} showing emerging trainee interest right now.`,
      evidence: Object.fromEntries(interestSummary.emergingTopics.slice(0, 3).map((t) => [t.topic, t.traineeCount])),
    });
  }

  return insights;
}
