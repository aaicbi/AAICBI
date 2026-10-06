import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { initializeCertWatermarkPayment } from "@/lib/paystack/certWatermarkBilling";

/**
 * POST /api/org-billing/pay-watermark — certificate watermark removal's
 * self-service Paystack checkout, mirroring org-billing/pay/route.ts
 * exactly for this separate product. No billingModel check — unlike
 * the platform fee, this product is available to an org regardless of
 * billingModel (a REVENUE_SHARE org can pay to remove the watermark the
 * same way a DIRECT_PAYMENT org can). Same deliberate getSession()-not-
 * requireRole choice as the platform-fee route, for the same reason: a
 * billing-gated ADMIN session must still be able to reach ITS OWN pay
 * routes.
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
    if (!org.certWatermarkFeeKobo || !org.certWatermarkBillingInterval) {
      return NextResponse.json({ error: "Watermark-removal pricing hasn't been set up yet. Please contact AAICBI." }, { status: 400 });
    }

    const fullOrg = await prisma.trainingOrganization.findUniqueOrThrow({
      where: { id: org.id },
      select: {
        id: true,
        name: true,
        email: true,
        certWatermarkFeeKobo: true,
        certWatermarkBillingInterval: true,
        certWatermarkPaystackPlanCode: true,
      },
    });
    const { authorizationUrl, reference } = await initializeCertWatermarkPayment(fullOrg);
    return NextResponse.json({ authorizationUrl, reference });
  });
}
