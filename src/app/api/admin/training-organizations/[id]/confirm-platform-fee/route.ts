import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { computePeriodEnd } from "@/lib/paystack/billingPeriod";

/**
 * POST /api/admin/training-organizations/[id]/confirm-platform-fee —
 * direct platform-fee billing's manual/offline payment channel: the
 * organization paid AAICBI by whatever means was arranged outside this
 * app (bank transfer, etc.), and SUPER_ADMIN confirms it here. Mirrors
 * exactly what a successful self-service Paystack charge does in
 * processConfirmedPlatformFeeCharge — same computePeriodEnd call, same
 * two fields set — so "access is active" means the same thing
 * regardless of which of the two payment channels produced it.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id } });
    if (!org) {
      return NextResponse.json({ error: "Training organization not found." }, { status: 404 });
    }
    if (org.billingModel !== "DIRECT_PAYMENT") {
      return NextResponse.json({ error: "This organization isn't on direct-payment billing." }, { status: 400 });
    }
    if (!org.platformFeeKobo || !org.platformFeeBillingInterval) {
      return NextResponse.json({ error: "Set a platform fee and billing interval before confirming payment." }, { status: 400 });
    }

    const updated = await prisma.trainingOrganization.update({
      where: { id: params.id },
      data: {
        platformFeeCurrentPeriodEnd: computePeriodEnd(new Date(), org.platformFeeBillingInterval),
        platformFeeAccessRevokedAt: null,
      },
    });
    return NextResponse.json(updated);
  });
}
