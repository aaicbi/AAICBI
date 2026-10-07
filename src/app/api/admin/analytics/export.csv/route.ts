import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getCoursePerformance, type PeriodRange } from "@/lib/analytics/aggregate";
import { resolveCourseIdsForSession, VALID_REPORT_DAYS } from "@/lib/analytics/reportData";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/** GET /api/admin/analytics/export.csv?days=30 — same zero-dependency
 * CSV pattern as /api/courses/[id]/performance/export.csv/route.ts.
 * Exports the content-performance table — the one section an admin is
 * most likely to want outside the dashboard (sharing with an
 * instructor, archiving a monthly snapshot).
 *
 * Security audit finding — the JSON dashboard route (GET /api/admin/analytics)
 * already blocks a training-org session outright (resolveCourseIdsForSession
 * returns undefined/unscoped for plain ADMIN, same as SUPER_ADMIN). This
 * sibling export route pulls from the identical unscoped data path but
 * never got the matching guard — a training-org session could download
 * the full platform-wide CSV directly, bypassing the dashboard's block.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const daysParam = Number(req.nextUrl.searchParams.get("days"));
    const days = VALID_REPORT_DAYS.includes(daysParam) ? daysParam : 30;
    const period: PeriodRange = { start: new Date(Date.now() - days * 24 * 60 * 60 * 1000), end: new Date() };
    const courseIds = await resolveCourseIdsForSession(session.role, session.userId);

    const rows = await getCoursePerformance(period, courseIds);

    const header = ["Course", "Views", "Unique Viewers", "Anonymous Views", "Enrollments", "Completions", "Completion Rate"];
    const csvRows = rows.map((r) => [
      r.title,
      String(r.views),
      String(r.uniqueViewers),
      String(r.anonymousViews),
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
