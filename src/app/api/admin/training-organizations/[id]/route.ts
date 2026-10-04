import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const PatchSchema = z.object({
  paystackSubaccountCode: z.string().trim().min(1).nullable().optional(),
  brandingFooterRemoved: z.boolean().optional(),
});

/**
 * PATCH /api/admin/training-organizations/[id] — Training Organizations,
 * Phase 2. The two payout/billing settings SUPER_ADMIN sets by hand
 * after arranging them outside this app: the Paystack Subaccount code
 * (created manually in Paystack's own dashboard — see
 * TrainingOrganization.paystackSubaccountCode's own schema comment for
 * why no separate split-percentage field exists here) and the
 * "Powered by aaicbi.org" premium-removal toggle. SUPER_ADMIN only,
 * not ADMIN — unlike the approve/reject decision (which ADMIN can also
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

    const updated = await prisma.trainingOrganization.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  });
}
