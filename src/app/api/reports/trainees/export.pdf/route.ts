import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rosterCourseIds } from "@/lib/reports/access";
import { getRoster } from "@/lib/reports/performance";
import { renderRosterPdf } from "@/lib/reports/reportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/trainees/export.pdf?q=&courseId=: the same roster as the CSV, as a PDF. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const ids = await rosterCourseIds(session, req.nextUrl.searchParams.get("courseId"));
    if (!ids) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    const { rows } = await getRoster(ids, (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80));
    const pdf = await renderRosterPdf("Trainee performance", rows);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="trainee-performance.pdf"` } });
  });
}
