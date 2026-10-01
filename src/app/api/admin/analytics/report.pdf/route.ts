import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getAnalyticsReportPayload, resolveCourseIdsForSession, VALID_REPORT_DAYS } from "@/lib/analytics/reportData";
import { renderAnalyticsReportPdf } from "@/lib/analytics/reportPdf";
import { notifyByEmail } from "@/lib/notifications/log";

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

const SendBodySchema = z.object({
  days: z.number().int(),
  email: z.string().email().max(255),
});

/**
 * POST /api/admin/analytics/report.pdf — "send by email" instead of
 * downloading. Same auth/scoping/data source as the GET above (an
 * INSTRUCTOR still only ever gets their own course-scoped report,
 * whoever they choose to send it to); the only new thing is an
 * admin-chosen destination address instead of the browser.
 *
 * Deliberately routed through notifyByEmail (the one path every other
 * email in this app goes through — see that function's own file
 * comment) rather than calling sendEmail directly, even though the
 * real recipient here isn't a platform account: recipientId is the
 * SENDING admin's own id, which gives this a genuine NotificationLog
 * audit row ("this admin sent a report, it succeeded/failed") and
 * shows up in their own in-app notification feed as a record that they
 * did this — not a notification *about* an event involving them, but
 * still the right account to attribute it to, since there's no
 * "external" recipientType in this schema and inventing one for a
 * single call site isn't worth it.
 *
 * The email body never echoes the destination address back — the
 * recipient already knows which inbox they're reading, and it avoids
 * needing to HTML-escape admin-supplied input for no real benefit.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const body = await req.json().catch(() => null);
    const parsed = SendBodySchema.safeParse(body);
    if (!parsed.success || !VALID_REPORT_DAYS.includes(parsed.data.days)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { days, email } = parsed.data;

    const courseIds = await resolveCourseIdsForSession(session.role, session.userId);
    const payload = await getAnalyticsReportPayload(days, courseIds);
    const pdfBuffer = await renderAnalyticsReportPdf({ ...payload, generatedAt: new Date() });

    await notifyByEmail({
      recipientType: "STAFF",
      recipientId: session.userId,
      to: email,
      type: "ANALYTICS_REPORT",
      subject: `AAICBI Analytics Report (Last ${days} Days)`,
      html: `<p>The ${days}-day AAICBI analytics report you requested is attached.</p>`,
      text: `The ${days}-day AAICBI analytics report you requested is attached.`,
      url: "/admin/analytics",
      attachments: [{ filename: `aaicbi-analytics-report-${days}d.pdf`, content: pdfBuffer }],
    });

    return NextResponse.json({ sent: true });
  });
}
