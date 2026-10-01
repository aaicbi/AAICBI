import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getAnalyticsReportPayload, resolveCourseIdsForSession, VALID_REPORT_DAYS } from "@/lib/analytics/reportData";

/**
 * GET /api/admin/analytics?days=30 — the analytics dashboard's one data
 * endpoint, returning every section in a single payload rather than one
 * round-trip per widget — this platform's real current scale makes that
 * genuinely cheap, and it keeps the page component simple (one fetch,
 * one loading state).
 *
 * SUPER_ADMIN/ADMIN see the platform-wide picture. INSTRUCTOR sees the
 * exact same shape, scoped to only the courses they created — a
 * deliberately different scoping rule than courseOwnership.ts's own
 * createdByFilter (which also scopes ADMIN to just their own courses,
 * the right call for course-BUILDING visibility but not for an
 * operational admin's analytics view, per the master prompt's own
 * Section 23: "ADMIN → Operational analytics").
 *
 * Phase 5 — the actual data-building now lives in reportData.ts, shared
 * with the PDF export route and the weekly scheduled report; this route
 * is just auth + param parsing + JSON serialization.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const daysParam = Number(req.nextUrl.searchParams.get("days"));
    const days = VALID_REPORT_DAYS.includes(daysParam) ? daysParam : 30;
    const courseIds = await resolveCourseIdsForSession(session.role, session.userId);

    const payload = await getAnalyticsReportPayload(days, courseIds);
    return NextResponse.json(payload);
  });
}
