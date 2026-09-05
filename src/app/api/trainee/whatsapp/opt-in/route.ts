import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { generateOtpCode, OTP_EXPIRY_MINUTES } from "@/lib/paystack/otp";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { rateLimit } from "@/lib/rateLimit";

// E.164: a leading +, then 7-15 digits, first digit non-zero — the
// same shape sendWhatsApp's own type comment already documents this
// project expecting.
const PhoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number in international format, e.g. +2348012345678."),
});

/**
 * POST /api/trainee/whatsapp/opt-in — starts phone verification for
 * WhatsApp notifications. Deliberately its own route, not folded into
 * the general settings PUT — the same "managed through its own route,
 * not a bare settings write" pattern already used for the avatar and
 * AI-credit-balance routes, since this one has a real side effect
 * (sending a verification code) a plain settings toggle doesn't.
 *
 * Reuses M28's OTP generator directly rather than a second,
 * near-identical one — the same 6-digit, cryptographically-random
 * shape already tested and used for payment unlock codes.
 *
 * Honest about what happens today: `sendWhatsApp` genuinely can't send
 * anything until WhatsApp is actually live (see that file's own
 * comment) — this route still runs the whole real flow (generates and
 * stores a code, attempts the send, reports the actual outcome) rather
 * than special-casing "not available yet," so nothing here needs to
 * change once a real provider is registered.
 *
 * Audit finding, fixed here: this originally had no rate limit at all
 * on the actual send. Harmless today, since sendWhatsApp can't
 * actually deliver anything yet — but a real, worth-closing-now gap
 * once it can: the phone number here is freely typed by the caller,
 * never pre-verified as belonging to them, so an unlimited send lets
 * an authenticated-but-malicious or compromised trainee account
 * repeatedly send unwanted OTP messages to an arbitrary third party's
 * number — a real harassment vector, not just a cost one. Keyed on
 * identity alone, not IP, the same audit finding M28's own OTP routes
 * already applied: this route requires an authenticated session first,
 * so including IP would let a stolen session get a fresh send
 * allowance just by rotating IP. A tighter limit than M28's guess-
 * checking routes (3, not 5) — sending is the more expensive,
 * more abuse-prone operation, not the one being guarded against
 * guessing.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = PhoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const limitKey = `whatsapp-optin:${session.userId}`;
    const limited = await rateLimit(limitKey, 3, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const otpCode = generateOtpCode();
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.trainee.update({
      where: { id: session.userId },
      data: {
        phone: parsed.data.phone,
        whatsappOptIn: true,
        whatsappVerifiedAt: null,
        whatsappOtpCode: otpCode,
        whatsappOtpExpiresAt: otpExpiresAt,
      },
    });

    const result = await sendWhatsApp({
      to: parsed.data.phone,
      templateName: "phone_verification",
      variables: { code: otpCode },
    });

    if (!result.ok) {
      return NextResponse.json(
        { sent: false, error: result.error ?? "Could not send a verification code right now." },
        { status: 200 }
      );
    }
    return NextResponse.json({ sent: true });
  });
}
