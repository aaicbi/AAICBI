import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
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
} from "@/lib/analytics/aggregate";
import { computeAllTraineeProfiles, getPlatformInterestSummary } from "@/lib/analytics/interestScoring";
import { getFixedSegments, getInterestSegments } from "@/lib/analytics/segments";
import { getRegistrationCohorts } from "@/lib/analytics/cohorts";

const VALID_DAYS = [7, 30, 90];

/**
 * GET /api/admin/analytics?days=30 — the Phase 1 analytics dashboard's
 * one data endpoint, returning every section in a single payload (KPIs,
 * funnel, content performance, feature usage, trend, lifecycle
 * breakdown) rather than one round-trip per widget — this platform's
 * real current scale makes that genuinely cheap, and it keeps the page
 * component simple (one fetch, one loading state).
 *
 * SUPER_ADMIN/ADMIN see the platform-wide picture. INSTRUCTOR sees the
 * exact same shape, scoped to only the courses they created — a
 * deliberately different scoping rule than courseOwnership.ts's own
 * createdByFilter (which also scopes ADMIN to just their own courses,
 * the right call for course-BUILDING visibility but not for an
 * operational admin's analytics view, per the master prompt's own
 * Section 23: "ADMIN → Operational analytics").
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const daysParam = Number(req.nextUrl.searchParams.get("days"));
    const days = VALID_DAYS.includes(daysParam) ? daysParam : 30;
    const period: PeriodRange = { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000), end: new Date() };

    const courseIds =
      session.role === "INSTRUCTOR"
        ? (await prisma.course.findMany({ where: { createdById: session.userId }, select: { id: true } })).map((c) => c.id)
        : undefined;

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

    // Analytics System Phase 3 — Interest Intelligence, Segments, and
    // Cohorts are all platform-wide-only (same reasoning as every other
    // platform-wide-only section above: an "interest" or a "cohort" is a
    // fact about a TRAINEE, not about one instructor's courses). Interest
    // profiles are computed ONCE here and shared between the summary and
    // the dynamic "Interested in X" segments — see
    // interestScoring.ts's own comment on why.
    let interestSummary = null;
    let segments = null;
    let cohorts = null;
    if (!courseIds) {
      const profiles = await computeAllTraineeProfiles();
      const [platformInterest, fixedSegments, interestSegments, registrationCohorts] = await Promise.all([
        getPlatformInterestSummary(undefined, profiles),
        getFixedSegments(),
        getInterestSegments(profiles),
        getRegistrationCohorts(),
      ]);
      interestSummary = platformInterest;
      segments = [...fixedSegments.summaries, ...interestSegments.summaries];
      cohorts = registrationCohorts;
    }

    return NextResponse.json({
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
    });
  });
}
