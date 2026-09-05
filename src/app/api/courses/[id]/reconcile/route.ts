import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { processConfirmedCharge } from "@/lib/paystack/reconcile";

const ReconcileSchema = z.object({ reference: z.string().min(1) });

/**
 * POST /api/courses/[id]/reconcile — M29's actual recourse: a trainee
 * who paid but whose CourseEnrollment never got the confirming
 * webhook, for whatever network reason, can check directly with
 * Paystack instead of being stuck with nothing to show for a real
 * payment and no option but contacting support.
 *
 * Genuinely safe for a trainee to call with an arbitrary reference,
 * not just trusted client input — `processConfirmedCharge` only ever
 * grants access to whoever Paystack's own verified transaction
 * metadata says, never to whoever happens to be calling this route.
 * The `traineeId` check below exists purely for the CALLER's own
 * feedback (so submitting someone else's reference gives a clear
 * answer, not silence), not as the actual security boundary — that
 * boundary is already the metadata check inside the shared function.
 *
 * Does its own idempotency check before calling the shared function,
 * matching the exact same (reference, eventType) guarantee the webhook
 * already provides — this route existing specifically because the
 * webhook MIGHT be the one that's missing doesn't mean it's safe to
 * skip that guarantee; the webhook could still arrive later, or a
 * trainee could click "recheck" twice.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = ReconcileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A payment reference is required." }, { status: 400 });
    }
    const { reference } = parsed.data;

    // Genuinely lightweight — this is meant for the real, occasional
    // case where a webhook was missed, not a repeated polling
    // endpoint. A generous limit that still catches obvious abuse
    // (someone scripting reference guesses) without getting in the way
    // of someone legitimately clicking "recheck" a few times while
    // waiting.
    const limitKey = `course-reconcile:${session.userId}`;
    const limited = await rateLimit(limitKey, 10, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again, or contact support." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const existingEvent = await prisma.paystackEvent.findUnique({
      where: { paystackReference_eventType: { paystackReference: reference, eventType: "charge.success" } },
    });
    if (existingEvent) {
      // Already processed — by the webhook, or by an earlier call to
      // this same route. Nothing left to do; tell the trainee plainly
      // rather than silently re-running logic that already ran.
      return NextResponse.json({
        status: "already_processed",
        message: "This payment has already been processed. Check the course page — your access should already be there.",
      });
    }

    // Recorded BEFORE calling the shared function, not after — the
    // exact same ordering the webhook itself uses, so a genuine race
    // (the real webhook arriving at almost the same instant this
    // route runs) can't result in both paths processing the same
    // charge twice.
    try {
      await prisma.paystackEvent.create({
        data: { paystackReference: reference, eventType: "charge.success", payload: { source: "manual-reconciliation", triggeredBy: session.userId } },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({
          status: "already_processed",
          message: "This payment has already been processed. Check the course page — your access should already be there.",
        });
      }
      throw e;
    }

    const result = await processConfirmedCharge(reference);

    switch (result.status) {
      case "no_metadata":
      case "invalid_course":
        return NextResponse.json(
          { error: "We couldn't find a matching payment for that reference. Please contact support." },
          { status: 404 }
        );
      case "not_genuine":
        return NextResponse.json(
          { error: "That payment doesn't appear to have succeeded. If you believe this is wrong, please contact support." },
          { status: 400 }
        );
      case "otp_issued":
      case "granted":
        if (result.traineeId !== session.userId || result.courseId !== params.id) {
          // The activation already correctly went to whoever the
          // reference genuinely belongs to — this is purely honest
          // feedback for the trainee who submitted a reference that
          // wasn't theirs, not a sign anything was granted incorrectly.
          return NextResponse.json(
            { error: "That reference doesn't match your account or this course." },
            { status: 400 }
          );
        }
        return NextResponse.json({
          status: result.status,
          message:
            result.status === "otp_issued"
              ? "Payment confirmed — check your email for an unlock code."
              : "Payment confirmed — your access has been restored.",
        });
    }
  });
}
