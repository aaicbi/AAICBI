import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";

const VerifySchema = z.object({ code: z.string().min(1) });

/**
 * POST /api/trainee/whatsapp/verify — the actual confirmation step.
 * Rate-limited the same deliberate way M28's course-unlock OTP is —
 * keyed on identity alone, not IP (the same audit finding from that
 * milestone applies here verbatim: this route requires an
 * authenticated session first, so including IP in the key would let
 * an attacker with a stolen session get a fresh guess allowance just
 * by rotating IP), and checked before the rate limit is touched, not
 * after (an already-verified trainee re-submitting an old code — a
 * slow network, a double click — shouldn't burn attempts on a no-op).
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A code is required." }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: { whatsappOtpCode: true, whatsappOtpExpiresAt: true, whatsappVerifiedAt: true },
    });
    if (!trainee.whatsappOtpCode) {
      return NextResponse.json({ error: "No pending verification found." }, { status: 404 });
    }
    if (trainee.whatsappVerifiedAt) {
      return NextResponse.json({ verified: true });
    }

    const limitKey = `whatsapp-otp:${session.userId}`;
    const limited = await rateLimit(limitKey, 5, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    if (!trainee.whatsappOtpExpiresAt || trainee.whatsappOtpExpiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 400 });
    }
    if (parsed.data.code !== trainee.whatsappOtpCode) {
      return NextResponse.json({ error: "That code isn't right. Please check and try again." }, { status: 400 });
    }

    await prisma.trainee.update({
      where: { id: session.userId },
      data: { whatsappVerifiedAt: new Date(), whatsappOtpCode: null, whatsappOtpExpiresAt: null },
    });
    return NextResponse.json({ verified: true });
  });
}
