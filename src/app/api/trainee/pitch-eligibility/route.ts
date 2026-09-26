import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/trainee/pitch-eligibility — Pitch & Post, Phase 1's
 * eligibility gate: holding at least one non-revoked Certificate. No
 * admin-configurable list of qualifying tracks (yet) — that's a
 * premature knob nobody has asked for; this is the simplest rule that
 * still ties pitching to actually finishing something.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const certificateCount = await prisma.certificate.count({
      where: { traineeId: session.userId, revokedAt: null },
    });
    return NextResponse.json({ eligible: certificateCount > 0 });
  });
}
