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
  type PeriodRange,
} from "@/lib/analytics/aggregate";

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

    const [overview, funnel, coursePerformance, featureUsage, trend, lifecycle, trafficSources, deviceBreakdown] = await Promise.all([
      getPlatformOverview(period, courseIds),
      getConversionFunnel(period, courseIds),
      getCoursePerformance(period, courseIds),
      getFeatureUsage(period, courseIds),
      getRegistrationTrend(period, courseIds),
      getLifecycleBreakdown(courseIds),
      getTrafficSources(period, courseIds),
      getDeviceBreakdown(period, courseIds),
    ]);

    return NextResponse.json({ days, overview, funnel, coursePerformance, featureUsage, trend, lifecycle, trafficSources, deviceBreakdown });
  });
}
