import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";

const VerifySchema = z.object({ code: z.string().min(1) });

/**
 * POST /api/courses/[id]/unlock — the actual OTP verification step.
 * Rate-limited using this project's existing `RateLimitBucket` system
 * (see rateLimit.ts) — the same real infrastructure the login routes
 * already use, not a second, parallel throttling mechanism, exactly as
 * the roadmap called for. A 6-digit numeric code is only genuinely
 * safe with a hard cap on wrong guesses; without one, exhausting all
 * million possibilities is a realistic scripted attack, not a
 * theoretical one.
 *
 * Two audit findings, fixed here:
 *
 * The rate-limit key deliberately does NOT include client IP, unlike
 * the login routes' key shape it otherwise mirrors. Login is reachable
 * anonymously — IP is a genuinely useful coarse signal there. This
 * route requires `requireRole("TRAINEE")` first, meaning an attacker
 * already needs a valid, authenticated session for that specific
 * trainee to reach it at all. For a fixed, already-authenticated
 * userId, including IP in the key would let that same attacker get a
 * fresh 5-guess allowance just by rotating IP (a VPN, a proxy) —
 * directly undermining the one thing a 6-digit code depends on.
 * Keying on (traineeId, courseId) alone closes that.
 *
 * The rate limit is also only ever consumed once an actual code
 * comparison is about to happen — not on every request regardless of
 * outcome. The unlock page auto-submits the emailed link on load, so
 * a trainee revisiting an already-unlocked course (a back button, a
 * refresh, multiple tabs) would otherwise burn through the same
 * 5-attempt budget on harmless, no-op traffic, and could genuinely get
 * locked out for doing nothing wrong. Checking enrollment state before
 * touching the rate limit — not after — means only genuine guesses
 * count against it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A code is required." }, { status: 400 });
    }

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: params.id } },
    });
    if (!enrollment || !enrollment.otpCode) {
      return NextResponse.json({ error: "No pending unlock found for this course." }, { status: 404 });
    }
    if (enrollment.unlockedAt) {
      // Already unlocked — idempotent, not an error, so re-submitting
      // (a slow network, a double click, clicking an already-used
      // email link again) doesn't surface a confusing failure for
      // something that already succeeded. Deliberately checked before
      // the rate limit below, not after — see this route's own top
      // comment on why.
      return NextResponse.json({ unlocked: true });
    }

    // A genuine guess is about to be evaluated — only now does it
    // count against the limit.
    const limitKey = `course-otp:${session.userId}:${params.id}`;
    const limited = await rateLimit(limitKey, 5, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    if (!enrollment.otpExpiresAt || enrollment.otpExpiresAt < new Date()) {
      return NextResponse.json({ error: "This code has expired. Contact support for a new one." }, { status: 400 });
    }
    if (parsed.data.code !== enrollment.otpCode) {
      return NextResponse.json({ error: "That code isn't right. Please check and try again." }, { status: 400 });
    }

    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { unlockedAt: new Date(), otpCode: null, otpExpiresAt: null },
    });
    return NextResponse.json({ unlocked: true });
  });
}
