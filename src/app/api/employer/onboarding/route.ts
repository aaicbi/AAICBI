import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/employer/onboarding — same reasoning as the trainee
 * route's own comment. Deliberately does not call
 * requireApprovedEmployer here — a not-yet-approved employer can
 * never actually see the walkthrough in the first place (the page
 * that would show it only renders once approvalState is APPROVED),
 * so this route never has anything to reject in practice; it's a
 * straightforward mark-as-seen, not a gated action.
 */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    await prisma.employer.update({
      where: { id: session.userId },
      data: { onboardingCompletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
