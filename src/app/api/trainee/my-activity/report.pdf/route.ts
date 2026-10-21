import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineeReport } from "@/lib/reports/performance";
import { renderTraineePdf } from "@/lib/reports/reportPdf";

/**
 * GET /api/trainee/my-activity/report.pdf — Dashboard/Examination
 * redesign. Same runtime/response pattern as the existing admin
 * analytics PDF export (GET /api/admin/analytics/report.pdf) — a
 * trainee's own data only, no new aggregation beyond what
 * traineeReportPdf.tsx's own data-gathering step reuses.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const report = await getTraineeReport(session.userId, { scopeNote: "Everything you have done on AAICBI." });
    if (!report) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const pdfBuffer = await renderTraineePdf(report);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="aaicbi-learning-report.pdf"`,
      },
    });
  });
}
