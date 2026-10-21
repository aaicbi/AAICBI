import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";

const Schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: z.string().min(8, "Use at least 8 characters for the new password.").max(200),
});

/**
 * POST /api/trainee/password: a signed-in trainee changes their own password. The current password must be right,
 * so someone who finds a signed-in phone cannot lock the owner out. Attempts are rate limited per account.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const limited = await rateLimit(`trainee-change-password:${session.userId}`, 5, 15 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    const trainee = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { id: true, passwordHash: true } });
    if (!trainee?.passwordHash) {
      return NextResponse.json({ error: "This account signs in with Google, so it has no password to change here." }, { status: 400 });
    }
    if (!(await verifyPassword(parsed.data.currentPassword, trainee.passwordHash))) {
      return NextResponse.json({ error: "Your current password is not right." }, { status: 400 });
    }
    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return NextResponse.json({ error: "Choose a password that is different from the current one." }, { status: 400 });
    }
    await prisma.trainee.update({ where: { id: trainee.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword), resetToken: null, resetTokenExpiresAt: null } });
    return NextResponse.json({ ok: true });
  });
}
