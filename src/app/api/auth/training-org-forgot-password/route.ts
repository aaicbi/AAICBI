import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notifyByEmail } from "@/lib/notifications/log";
import { passwordResetEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const Schema = z.object({ email: z.string().email() });
const LIFETIME_MS = 60 * 60 * 1000; // one hour: the link grants access to the account

/**
 * POST /api/auth/training-org-forgot-password — emails a reset link to a
 * training organization's owner or to one of its teammates. The answer is
 * the same whether or not the address belongs to an account, so this cannot
 * be used to find out which emails are registered. A teammate's link reuses
 * their invitation token (the same /org/reset-password page accepts either),
 * and a disabled teammate gets nothing.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limited = await rateLimit(`org-forgot-password:${clientIp(req)}`, 5, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
    }
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const token = randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + LIFETIME_MS);
    let recipient: { id: string; email: string } | null = null;

    const owner = await prisma.trainingOrganization.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true } });
    if (owner) {
      await prisma.trainingOrganization.update({ where: { id: owner.id }, data: { resetToken: token, resetTokenExpiresAt: expires } });
      recipient = owner;
    } else {
      const member = await prisma.trainingOrganizationMember.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true, disabledAt: true } });
      if (member && !member.disabledAt) {
        await prisma.trainingOrganizationMember.update({ where: { id: member.id }, data: { setupToken: token, setupTokenExpiresAt: expires } });
        recipient = member;
      }
    }

    if (recipient) {
      const email = passwordResetEmail("organization", appUrl(`/org/reset-password?token=${token}`));
      await notifyByEmail({ recipientType: "STAFF", recipientId: recipient.id, to: recipient.email, type: "PASSWORD_RESET_ORGANIZATION", subject: email.subject, html: email.html, text: email.text });
    }
    return NextResponse.json({ message: "If an account exists for that email, a password reset link has been sent." });
  });
}
