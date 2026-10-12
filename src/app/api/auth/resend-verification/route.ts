import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { resendVerification } from "@/lib/auth/traineeSignup";

export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().trim().email() });

/**
 * POST { email } — send the verification link again. The answer is the same whether or not that address has an unverified
 * account, so this cannot be used to discover who is registered. Limited to 3 a hour for each address and connection.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const limited = await rateLimit(`resend-verify:${clientIp(req)}:${parsed.data.email}`, 3, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "We already sent it a few times. Please wait a while and check your spam folder." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
    }
    await resendVerification(parsed.data.email).catch((e) => console.error("Resending the verification email failed:", e));
    return NextResponse.json({ ok: true });
  });
}
