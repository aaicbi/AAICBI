import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getLiveActivity } from "@/lib/analytics/aggregate";

/**
 * GET /api/admin/analytics/live — Analytics System Phase 5. Platform-
 * wide only, SUPER_ADMIN/ADMIN only (not INSTRUCTOR — see
 * getLiveActivity's own comment on why a 15-minute window isn't
 * meaningfully scopable to one instructor's courses). Polled by
 * LiveActivityCard every 20 seconds — this route itself is cheap (six
 * short, indexed queries), so that cadence is fine at this platform's
 * real scale.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    return NextResponse.json(await getLiveActivity());
  });
}
