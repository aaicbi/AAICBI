import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rosterCourseIds } from "@/lib/reports/access";
import { getRoster } from "@/lib/reports/performance";
import { fmtDate, toCsv } from "@/lib/reports/performanceCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/trainees/export.csv?q=&courseId=: a performance line per trainee in the caller's courses. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const ids = await rosterCourseIds(session, req.nextUrl.searchParams.get("courseId"));
    if (!ids) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    const { rows } = await getRoster(ids, (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80));
    const csv = toCsv(["Name", "Email", "Courses", "Average progress %", "Assessment attempts", "Assessments passed", "Average score %", "Game questions played", "Game accuracy %", "Engagement", "Last active"],
      rows.map((r) => [r.name, r.email, r.courses, r.percent, r.attempts, r.passed, r.average ?? "", r.gamePlayed, r.gameAccuracy ?? "", r.level, fmtDate(r.lastActive)]));
    return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trainee-performance.csv"` } });
  });
}
