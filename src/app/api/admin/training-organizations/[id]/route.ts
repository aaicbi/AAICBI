import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const PatchSchema = z.object({
  paystackSubaccountCode: z.string().trim().min(1).nullable().optional(),
  brandingFooterRemoved: z.boolean().optional(),
  // Direct platform-fee billing — SUPER_ADMIN's own negotiated rate for
  // a DIRECT_PAYMENT organization (see TrainingOrganization.
  // platformFeeKobo's own schema comment). billingModel is also editable
  // here in case SUPER_ADMIN needs to correct what the org picked at
  // registration.
  billingModel: z.enum(["REVENUE_SHARE", "DIRECT_PAYMENT"]).optional(),
  platformFeeKobo: z.number().int().positive().nullable().optional(),
  platformFeeBillingInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]).nullable().optional(),
  suspendTraineeAccessOnLapse: z.boolean().optional(),
});

/**
 * PATCH /api/admin/training-organizations/[id] — Training Organizations,
 * Phase 2. The payout/billing settings SUPER_ADMIN sets by hand after
 * arranging them outside this app: the Paystack Subaccount code
 * (created manually in Paystack's own dashboard — see
 * TrainingOrganization.paystackSubaccountCode's own schema comment for
 * why no separate split-percentage field exists here), the
 * "Powered by aaicbi.org" premium-removal toggle, and (direct
 * platform-fee billing) the negotiated platform fee/interval and the
 * suspend-trainees-on-lapse discretion toggle. SUPER_ADMIN only, not
 * ADMIN — unlike the approve/reject decision (which ADMIN can also
 * make), these are financial settings with no equivalent elsewhere in
 * this app that ADMIN is trusted with.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id } });
    if (!org) {
      return NextResponse.json({ error: "Training organization not found." }, { status: 404 });
    }

    // Direct platform-fee billing — same reset-on-pricing-change rule
    // PUT /api/courses/[id] already applies to Course.paystackPlanCode:
    // a stale Plan priced/cadenced under the OLD terms must never be
    // reused once either changes, so the next payment attempt lazily
    // creates a fresh one matching the current terms instead.
    const resultingFeeKobo = parsed.data.platformFeeKobo !== undefined ? parsed.data.platformFeeKobo : org.platformFeeKobo;
    const resultingInterval =
      parsed.data.platformFeeBillingInterval !== undefined ? parsed.data.platformFeeBillingInterval : org.platformFeeBillingInterval;
    const feeTermsChanged = resultingFeeKobo !== org.platformFeeKobo || resultingInterval !== org.platformFeeBillingInterval;

    const updated = await prisma.trainingOrganization.update({
      where: { id: params.id },
      data: feeTermsChanged ? { ...parsed.data, platformFeePaystackPlanCode: null } : parsed.data,
    });
    return NextResponse.json(updated);
  });
}
