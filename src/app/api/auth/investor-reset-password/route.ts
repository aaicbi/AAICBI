import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { withApiErrors } from "@/lib/apiError";

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * POST /api/auth/investor-reset-password — the same token+expiry
 * mechanism as staff's /api/auth/reset-password, against `Investor`
 * instead of `User`. This is also how a newly admin-created investor
 * sets their initial usable password, via the setup link emailed by
 * POST /api/admin/investors.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = await req.json().catch(() => null);
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      );
    }

    const investor = await prisma.investor.findUnique({ where: { resetToken: parsed.data.token } });
    if (!investor || !investor.resetTokenExpiresAt || investor.resetTokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.investor.update({
      where: { id: investor.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    });

    return NextResponse.json({ ok: true });
  });
}
