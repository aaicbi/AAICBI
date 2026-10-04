import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { initializePlatformFeePayment } from "@/lib/paystack/orgBilling";

/**
 * POST /api/org-billing/pay — direct platform-fee billing's self-service
 * Paystack checkout. Deliberately calls getSession() directly, NOT
 * requireRole — requireRole("ADMIN") now throws for exactly the
 * billing-gated session this route exists to let pay its way out of
 * (see session.ts's own comment on that check), so routing through it
 * here would make this route permanently unreachable by the one caller
 * who needs it. Real authentication is still enforced below (a 401 for
 * no session, a 404 for anyone who isn't this organization's own
 * session) — only the billing gate itself is deliberately bypassed,
 * which is safe precisely because this route can only ever let an
 * organization pay for ITS OWN access, never anyone else's.
 */
export async function POST() {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    const org = await findTrainingOrgByStaffUserId(session.userId);
    if (!org) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (org.billingModel !== "DIRECT_PAYMENT") {
      return NextResponse.json({ error: "This organization isn't on direct-payment billing." }, { status: 400 });
    }
    if (!org.platformFeeKobo || !org.platformFeeBillingInterval) {
      return NextResponse.json({ error: "Your platform fee hasn't been set up yet. Please contact AAICBI." }, { status: 400 });
    }

    const fullOrg = await prisma.trainingOrganization.findUniqueOrThrow({
      where: { id: org.id },
      select: {
        id: true,
        name: true,
        email: true,
        platformFeeKobo: true,
        platformFeeBillingInterval: true,
        platformFeePaystackPlanCode: true,
      },
    });
    const { authorizationUrl, reference } = await initializePlatformFeePayment(fullOrg);
    return NextResponse.json({ authorizationUrl, reference });
  });
}
