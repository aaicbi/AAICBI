import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notifyByEmail } from "@/lib/notifications/log";
import { passwordResetEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const ForgotPasswordSchema = z.object({ email: z.string().email() });
const RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 hour — shorter than email-verify's 48h since a
// password-reset link grants account access, not just a verification flag

/**
 * M9 audit finding #3: no password-reset path existed at all — a
 * trainee who forgot their password had no way back into their account,
 * and now that login is rate-limited (finding #1), an admin couldn't
 * easily help them either, since there was no admin-side reset either.
 *
 * Always returns the same generic success message whether or not the
 * email is registered — same reasoning as the login routes' identical
 * "invalid email or password" for both cases: don't let this endpoint
 * become a way to enumerate which emails have accounts.
 *
 * Actually sending the reset email is the same documented, not-yet-
 * wired gap as email verification — see the TODO below and the M14
 * milestone. The route and the token it generates work correctly today
 * without it.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limitKey = `trainee-forgot-password:${clientIp(req)}`;
    const limited = await rateLimit(limitKey, 5, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { email: parsed.data.email } });
    if (trainee) {
      const resetToken = randomBytes(24).toString("hex");
      await prisma.trainee.update({
        where: { id: trainee.id },
        data: { resetToken, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_LIFETIME_MS) },
      });
      // M14: password reset is a security-critical, essential email —
      // always sent regardless of Trainee.notificationsEnabled, same
      // reasoning as the welcome email (see log.ts's
      // shouldNotifyTrainee, which this deliberately does NOT call).
      const resetUrl = appUrl(`/trainee/reset-password?token=${resetToken}`);
      const email = passwordResetEmail("trainee", resetUrl);
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: trainee.id,
        to: trainee.email,
        type: "PASSWORD_RESET_TRAINEE",
        subject: email.subject,
        html: email.html,
        text: email.text,
        // M43 — real, likely to actually fire: unlike the welcome
        // email, a trainee requesting a password reset could genuinely
        // already have WhatsApp verified from an earlier session.
        whatsapp: { templateName: "password_reset", variables: { name: trainee.name, reset_url: resetUrl } },
      });
    }

    return NextResponse.json({
      message: "If an account exists for that email, a password reset link has been generated for it.",
    });
  });
}
