import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineeReportData, renderTraineeReportPdf } from "@/lib/trainee/traineeReportPdf";

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

    const data = await getTraineeReportData(session.userId);
    const pdfBuffer = await renderTraineeReportPdf(data);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="aaicbi-learning-report.pdf"`,
      },
    });
  });
}
