import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getLiveActivity } from "@/lib/analytics/aggregate";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/analytics/live — Analytics System Phase 5. Platform-
 * wide only, SUPER_ADMIN/ADMIN only (not INSTRUCTOR — see
 * getLiveActivity's own comment on why a 15-minute window isn't
 * meaningfully scopable to one instructor's courses). Polled by
 * LiveActivityCard every 20 seconds — this route itself is cheap (six
 * short, indexed queries), so that cadence is fine at this platform's
 * real scale.
 *
 * Security audit finding — "platform-wide only" was never enforced
 * against a training-org session, which is also plain "ADMIN".
 * LiveActivityCard silently renders nothing for such a session, but
 * the route itself was directly reachable with no guard.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(await getLiveActivity());
  });
}
