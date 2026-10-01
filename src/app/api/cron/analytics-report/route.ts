import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getAnalyticsReportPayload } from "@/lib/analytics/reportData";
import { renderAnalyticsReportPdf } from "@/lib/analytics/reportPdf";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";

const REPORT_WINDOW_DAYS = 7;

/**
 * GET /api/cron/analytics-report — Analytics System Phase 5. A third,
 * separate cron entry (see vercel.json), same CRON_SECRET bearer-auth
 * pattern as the existing two. One weekly cadence only — not separately
 * daily/monthly/quarterly, a deliberate trim (see the Phase 5 plan's own
 * reasoning); an admin who wants a different window can already
 * generate one on demand via GET /api/admin/analytics/report.pdf.
 * Platform-wide report only (no per-instructor scoping — this mirrors
 * every other platform-wide-only cron/alert in this system).
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getAnalyticsReportPayload(REPORT_WINDOW_DAYS);
    const pdfBuffer = await renderAnalyticsReportPdf({ ...payload, generatedAt: new Date() });

    await notifyAllAdminStaff(
      "ANALYTICS_REPORT",
      undefined,
      {
        subject: "AAICBI Weekly Analytics Report",
        html: "<p>Your weekly analytics report is attached — platform activity, content performance, interests, and segments for the last 7 days.</p>",
        text: "Your weekly analytics report is attached — platform activity, content performance, interests, and segments for the last 7 days.",
      },
      "/admin/analytics",
      [{ filename: "aaicbi-analytics-report-weekly.pdf", content: pdfBuffer }]
    );

    return NextResponse.json({ sent: true });
  });
}
