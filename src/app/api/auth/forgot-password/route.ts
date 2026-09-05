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
const RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 hour — see trainee-forgot-password/route.ts for reasoning

/** Staff-side equivalent of trainee-forgot-password/route.ts — same
 * generic-response, same rate limiting, same reasoning. Staff accounts
 * had exactly the same "no recovery path at all" gap as trainees. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limitKey = `admin-forgot-password:${clientIp(req)}`;
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

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      const resetToken = randomBytes(24).toString("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_LIFETIME_MS) },
      });
      // M14: sent inside the `if (user)` block, same as the token
      // itself — never let this branch's timing or behavior differ
      // based on whether the send succeeds, so the generic response
      // below stays genuinely generic either way.
      const resetUrl = appUrl(`/admin/reset-password?token=${resetToken}`);
      const email = passwordResetEmail("staff", resetUrl);
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: user.id,
        to: user.email,
        type: "PASSWORD_RESET_STAFF",
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    }

    return NextResponse.json({
      message: "If an account exists for that email, a password reset link has been generated for it.",
    });
  });
}
