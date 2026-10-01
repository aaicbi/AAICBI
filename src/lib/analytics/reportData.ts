/**
 * Analytics System Phase 5 — the shared data-building step behind
 * GET /api/admin/analytics (JSON), GET /api/admin/analytics/report.pdf
 * (on-demand PDF), and the weekly analytics-report cron (scheduled PDF
 * email). Extracted from what was originally just the JSON route's own
 * body — three consumers independently re-deriving this would be
 * exactly the kind of drift this codebase's own established discipline
 * avoids (see interestScoring.ts's own comment on sharing one computed
 * pass for a similar reason).
 */
import { prisma } from "@/lib/prisma";
import {
  getPlatformOverview,
  getConversionFunnel,
  getCoursePerformance,
  getFeatureUsage,
  getRegistrationTrend,
  getLifecycleBreakdown,
  getTrafficSources,
  getDeviceBreakdown,
  getSearchDemand,
  type PeriodRange,
  type PlatformOverview,
  type FunnelStage,
  type CoursePerformanceRow,
  type FeatureUsageRow,
  type RegistrationTrendPoint,
  type CategoryCount,
  type SearchDemand,
} from "@/lib/analytics/aggregate";
import { computeAllTraineeProfiles, getPlatformInterestSummary, type PlatformInterestSummary } from "@/lib/analytics/interestScoring";
import { getFixedSegments, getInterestSegments, type SegmentSummary } from "@/lib/analytics/segments";
import { getRegistrationCohorts, type CohortRow } from "@/lib/analytics/cohorts";
import { getAutomatedInsights, type Insight } from "@/lib/analytics/insights";
import { type LifecycleTag } from "@/lib/analytics/lifecycleCore";

export const VALID_REPORT_DAYS = [7, 30, 90];

export interface AnalyticsReportPayload {
  days: number;
  overview: PlatformOverview;
  funnel: FunnelStage[];
  coursePerformance: CoursePerformanceRow[];
  featureUsage: FeatureUsageRow[];
  trend: RegistrationTrendPoint[];
  lifecycle: Record<LifecycleTag, number> | null;
  trafficSources: CategoryCount[] | null;
  deviceBreakdown: CategoryCount[] | null;
  searchDemand: SearchDemand | null;
  interestSummary: PlatformInterestSummary | null;
  segments: SegmentSummary[] | null;
  cohorts: CohortRow[] | null;
  insights: Insight[] | null;
}

/** INSTRUCTOR scoping — resolves their own course-id set, or undefined for platform-wide roles. */
export async function resolveCourseIdsForSession(role: string, userId: string): Promise<string[] | undefined> {
  if (role !== "INSTRUCTOR") return undefined;
  const courses = await prisma.course.findMany({ where: { createdById: userId }, select: { id: true } });
  return courses.map((c) => c.id);
}

export async function getAnalyticsReportPayload(days: number, courseIds?: string[]): Promise<AnalyticsReportPayload> {
  const period: PeriodRange = { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000), end: new Date() };

  const [overview, funnel, coursePerformance, featureUsage, trend, lifecycle, trafficSources, deviceBreakdown, searchDemand] =
    await Promise.all([
      getPlatformOverview(period, courseIds),
      getConversionFunnel(period, courseIds),
      getCoursePerformance(period, courseIds),
      getFeatureUsage(period, courseIds),
      getRegistrationTrend(period, courseIds),
      getLifecycleBreakdown(courseIds),
      getTrafficSources(period, courseIds),
      getDeviceBreakdown(period, courseIds),
      getSearchDemand(period, courseIds),
    ]);

  let interestSummary: PlatformInterestSummary | null = null;
  let segments: SegmentSummary[] | null = null;
  let cohorts: CohortRow[] | null = null;
  let insights: Insight[] | null = null;
  if (!courseIds) {
    const profiles = await computeAllTraineeProfiles();
    const [platformInterest, fixedSegments, interestSegments, registrationCohorts, automatedInsights] = await Promise.all([
      getPlatformInterestSummary(undefined, profiles),
      getFixedSegments(),
      getInterestSegments(profiles),
      getRegistrationCohorts(),
      getAutomatedInsights(days),
    ]);
    interestSummary = platformInterest;
    segments = [...fixedSegments.summaries, ...interestSegments.summaries];
    cohorts = registrationCohorts;
    insights = automatedInsights;
  }

  return {
    days,
    overview,
    funnel,
    coursePerformance,
    featureUsage,
    trend,
    lifecycle,
    trafficSources,
    deviceBreakdown,
    searchDemand,
    interestSummary,
    segments,
    cohorts,
    insights,
  };
}
