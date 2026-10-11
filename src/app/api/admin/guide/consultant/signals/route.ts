import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { buildSnapshot } from "@/lib/guide/snapshot";
import { deriveSignals } from "@/lib/guide/monitorCore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/admin/guide/consultant/signals?days=30 — SUPER_ADMIN reads the monitoring signals. Plain rules over aggregate numbers: no AI, free, works with the consultant switched off. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 30));
    const snap = await buildSnapshot(days);
    return NextResponse.json({
      generatedAt: snap.generatedAt,
      periodDays: snap.periodDays,
      signals: deriveSignals(snap),
      totals: { courses: snap.courses.length, trainees: snap.courses.reduce((n, c) => n + c.trainees, 0), enrollments: snap.analytics.enrollments, completions: snap.analytics.completions },
    });
  });
}
