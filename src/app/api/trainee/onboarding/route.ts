import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/trainee/onboarding — marks the walkthrough seen, whether
 * the trainee finished every step or skipped partway through; see
 * OnboardingWalkthrough's own comment for why those two cases are
 * treated identically here. A real timestamp, not a boolean — see
 * Trainee.onboardingCompletedAt's own schema comment for why that's
 * worth keeping.
 */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    await prisma.trainee.update({
      where: { id: session.userId },
      data: { onboardingCompletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
