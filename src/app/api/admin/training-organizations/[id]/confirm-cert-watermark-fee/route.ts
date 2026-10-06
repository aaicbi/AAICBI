import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { computePeriodEnd } from "@/lib/paystack/billingPeriod";

/**
 * POST /api/admin/training-organizations/[id]/confirm-cert-watermark-fee
 * — certificate watermark removal's manual/offline payment channel,
 * mirroring confirm-platform-fee/route.ts exactly for this separate
 * product. No billingModel check — this product has nothing to do with
 * billingModel.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id } });
    if (!org) {
      return NextResponse.json({ error: "Training organization not found." }, { status: 404 });
    }
    if (!org.certWatermarkFeeKobo || !org.certWatermarkBillingInterval) {
      return NextResponse.json({ error: "Set a watermark-removal fee and billing interval before confirming payment." }, { status: 400 });
    }

    const updated = await prisma.trainingOrganization.update({
      where: { id: params.id },
      data: {
        certWatermarkCurrentPeriodEnd: computePeriodEnd(new Date(), org.certWatermarkBillingInterval),
        certWatermarkAccessRevokedAt: null,
      },
    });
    return NextResponse.json(updated);
  });
}
