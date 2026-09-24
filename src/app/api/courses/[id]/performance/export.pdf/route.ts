import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineePerformanceRows, getPerformanceKpis } from "@/lib/performanceDashboard";
import { renderPerformancePdf } from "@/lib/performancePdf";

/** GET /api/courses/[id]/performance/export.pdf?cohortId=&moduleId= —
 * same ownership pattern as the parent performance route; PDF built
 * fresh per request, same as curriculumPdf.tsx, no persistence.
 * `runtime = "nodejs"` because @react-pdf/renderer needs Node APIs. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const course = await prisma.course.findUnique({ where: { id: params.id }, select: { createdById: true, title: true } });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const cohortId = req.nextUrl.searchParams.get("cohortId") ?? undefined;
    const moduleId = req.nextUrl.searchParams.get("moduleId") ?? undefined;
    const filters = { cohortId, moduleId };

    const [kpis, rows] = await Promise.all([getPerformanceKpis(params.id, filters), getTraineePerformanceRows(params.id, filters)]);
    const pdfBuffer = await renderPerformancePdf(course.title, kpis, rows);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="performance-${params.id}.pdf"`,
      },
    });
  });
}
