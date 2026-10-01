import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getAnalyticsReportPayload, resolveCourseIdsForSession, VALID_REPORT_DAYS } from "@/lib/analytics/reportData";
import { renderAnalyticsReportPdf } from "@/lib/analytics/reportPdf";

/**
 * GET /api/admin/analytics/report.pdf?days=30 — Analytics System
 * Phase 5. Same auth/scoping and data source as GET /api/admin/analytics
 * (reportData.ts), same runtime/response pattern as the existing
 * course-performance PDF export
 * (src/app/api/courses/[id]/performance/export.pdf/route.ts).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const daysParam = Number(req.nextUrl.searchParams.get("days"));
    const days = VALID_REPORT_DAYS.includes(daysParam) ? daysParam : 30;
    const courseIds = await resolveCourseIdsForSession(session.role, session.userId);

    const payload = await getAnalyticsReportPayload(days, courseIds);
    const pdfBuffer = await renderAnalyticsReportPdf({ ...payload, generatedAt: new Date() });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="aaicbi-analytics-report-${days}d.pdf"`,
      },
    });
  });
}
