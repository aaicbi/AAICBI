import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getTraineePerformanceRows } from "@/lib/performanceDashboard";

const TREND_LABEL: Record<string, string> = { improving: "Improving", declining: "Declining", flat: "Flat", "insufficient-data": "Insufficient data" };
const CERT_LABEL: Record<string, string> = { ISSUED: "Issued", REVOKED: "Revoked", NOT_YET: "Not yet" };

/** GET /api/courses/[id]/performance/export.csv?cohortId=&moduleId= —
 * same zero-dependency pattern as /api/results/[id]/export/route.ts. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const course = await prisma.course.findUnique({ where: { id: params.id }, select: { createdById: true } });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const cohortId = req.nextUrl.searchParams.get("cohortId") ?? undefined;
    const moduleId = req.nextUrl.searchParams.get("moduleId") ?? undefined;
    const rows = await getTraineePerformanceRows(params.id, { cohortId, moduleId });

    const header = [
      "Name", "Email", "Modules Completed", "Total Modules", "Completion %",
      "First Score", "Best Score", "Latest Score", "Average Score", "Total Attempts",
      "Passed On Attempt", "Trend", "Certification Status", "At Risk", "At Risk Reason",
    ];
    const csvRows = rows.map((r) => [
      r.name,
      r.email,
      String(r.completedModules),
      String(r.totalModules),
      `${r.completionPct}%`,
      r.firstScore != null ? `${Math.round(r.firstScore)}%` : "",
      r.bestScore != null ? `${Math.round(r.bestScore)}%` : "",
      r.latestScore != null ? `${Math.round(r.latestScore)}%` : "",
      r.averageScore != null ? `${Math.round(r.averageScore)}%` : "",
      String(r.totalAttempts),
      r.passedOnAttempt != null ? String(r.passedOnAttempt) : "",
      TREND_LABEL[r.trend],
      CERT_LABEL[r.certificationStatus],
      r.isAtRisk ? "Yes" : "No",
      r.atRiskReasons.join("; "),
    ]);

    const csv = [header, ...csvRows].map((row) => row.map(csvEscape).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="performance-${params.id}.csv"`,
      },
    });
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
