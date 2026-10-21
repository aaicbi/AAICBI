import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { scopeForTrainee } from "@/lib/reports/access";
import { getTraineeReport } from "@/lib/reports/performance";
import { renderTraineePdf } from "@/lib/reports/reportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/trainees/[id]/report.pdf: one trainee's full performance report. Staff see only trainees enrolled in their own courses. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const scope = await scopeForTrainee(session, params.id);
    const report = scope ? await getTraineeReport(params.id, scope) : null;
    if (!report) return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    const pdf = await renderTraineePdf(report);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="performance-${report.trainee.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"` } });
  });
}
