import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getCoursePerformance, type PeriodRange } from "@/lib/analytics/aggregate";

const VALID_DAYS = [7, 30, 90];

/** GET /api/admin/analytics/export.csv?days=30 — same zero-dependency
 * CSV pattern as /api/courses/[id]/performance/export.csv/route.ts.
 * Exports the content-performance table — the one section an admin is
 * most likely to want outside the dashboard (sharing with an
 * instructor, archiving a monthly snapshot). */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const daysParam = Number(req.nextUrl.searchParams.get("days"));
    const days = VALID_DAYS.includes(daysParam) ? daysParam : 30;
    const period: PeriodRange = { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000), end: new Date() };

    const courseIds =
      session.role === "INSTRUCTOR"
        ? (await prisma.course.findMany({ where: { createdById: session.userId }, select: { id: true } })).map((c) => c.id)
        : undefined;

    const rows = await getCoursePerformance(period, courseIds);

    const header = ["Course", "Views", "Unique Viewers", "Enrollments", "Completions", "Completion Rate"];
    const csvRows = rows.map((r) => [
      r.title,
      String(r.views),
      String(r.uniqueViewers),
      String(r.enrollments),
      String(r.completions),
      r.completionRate != null ? `${r.completionRate}%` : "",
    ]);

    const csv = [header, ...csvRows].map((row) => row.map(csvEscape).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-content-performance-${days}d.csv"`,
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
