import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * POST /api/trainee/whatsapp/opt-out — turns WhatsApp delivery back
 * off. Deliberately leaves `Trainee.phone` itself untouched — that
 * field predates this milestone (M9) as general contact info, not
 * something this route owns exclusively, so opting out of WhatsApp
 * shouldn't silently erase a phone number that might be used or shown
 * elsewhere. Only the WhatsApp-specific state resets.
 */
export async function POST() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    await prisma.trainee.update({
      where: { id: session.userId },
      data: { whatsappOptIn: false, whatsappVerifiedAt: null, whatsappOtpCode: null, whatsappOtpExpiresAt: null },
    });
    return NextResponse.json({ ok: true });
  });
}
