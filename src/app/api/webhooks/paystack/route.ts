import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaystackSignature } from "@/lib/paystack/verifySignature";
import { redactPaystackPayloadForStorage } from "@/lib/paystack/redact";
import { processConfirmedCharge } from "@/lib/paystack/reconcile";
import { findEnrollmentForSubscriptionEvent } from "@/lib/paystack/correlate";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import {
  paymentFailedEmail,
  subscriptionEndingEmail,
  subscriptionEndedEmail,
} from "@/lib/notifications/templates";

/**
 * POST /api/webhooks/paystack — built and hardened first, per the
 * roadmap's own framing, before anything trainee-facing depends on it.
 * Genuinely unauthenticated by session (Paystack, not a trainee or
 * staff member, calls this) — the signature check below is the entire
 * authentication mechanism, which is exactly why it has to be right.
 *
 * The single most common real-world Paystack integration mistake,
 * confirmed by checking current documentation and multiple independent
 * guides rather than assumed: frameworks that parse the body before it
 * can be read raw, which silently breaks signature verification even
 * for genuine requests. `req.text()` is called first, deliberately,
 * before any JSON parsing — never `req.json()` first.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY is not set — cannot verify any incoming webhook. Rejecting.");
    return new NextResponse("Not configured", { status: 500 });
  }
  if (!verifyPaystackSignature(rawBody, signature, secretKey)) {
    // Deliberately vague — never confirm or deny *why* verification
    // failed to whoever's calling. A missing header and a wrong
    // signature both just mean "not trusted," and there's no reason to
    // help a genuine attacker debug which part of a forged request was
    // wrong.
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  if (typeof event !== "object" || event === null || !("event" in event) || !("data" in event)) {
    return new NextResponse("Unexpected event shape", { status: 400 });
  }
  const eventType = (event as { event: unknown }).event;
  const data = (event as { data: unknown }).data;
  if (typeof eventType !== "string" || typeof data !== "object" || data === null || !("reference" in data)) {
    return new NextResponse("Unexpected event shape", { status: 400 });
  }
  const reference = (data as { reference: unknown }).reference;
  if (typeof reference !== "string") {
    return new NextResponse("Unexpected event shape", { status: 400 });
  }

  // Idempotency — Paystack retries aggressively whenever it isn't
  // confident a webhook was received, so the SAME event genuinely
  // does arrive more than once in normal operation. An individual
  // create with a caught unique-constraint conflict, the same sticky-
  // exactly-once discipline already used for ModuleCompletion,
  // Certificate, and Badge elsewhere in this project — see the schema
  // comment on PaystackEvent for why the key is (reference, eventType)
  // together, not reference alone.
  try {
    await prisma.paystackEvent.create({
      data: { paystackReference: reference, eventType, payload: redactPaystackPayloadForStorage(event) as object },
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      // Already processed this exact event — Paystack still needs its
      // 200 to know delivery succeeded and stop retrying, even though
      // there's genuinely nothing left to do.
      return NextResponse.json({ received: true });
    }
    throw e;
  }

  // The real, defense-in-depth check the guidance above calls "the one
  // thing to never skip" — never act on the webhook payload's own
  // claimed status alone. For charge.success specifically, confirm
  // directly with Paystack before granting anything.
  if (eventType === "charge.success") {
    try {
      await processConfirmedCharge(reference);
    } catch (e) {
      // A failed verify call must never surface as a 4xx/5xx back to
      // Paystack for an event that's already safely recorded above —
      // that would just trigger pointless retries of an event this
      // app has already durably logged. Paystack still gets its 200;
      // the verify failure is logged for staff to investigate.
      console.error(`Paystack verify call failed for reference ${reference}:`, e);
    }
  }

  // M26 — the honest, deliberately uncertain half of this webhook,
  // stated plainly rather than confidently guessed at. `subscription.
  // create` is where Paystack sends the real subscription code
  // (needed for the events below to correlate reliably by it),
  // separately from charge.success — confirmed across multiple
  // sources that these are genuinely two different events, not one.
  // What could NOT be confirmed with the same confidence: this event's
  // exact payload shape at the field level — Paystack's own
  // documentation doesn't publish a verbatim example, and even a real
  // developer forum question asking this exact thing had no confirmed
  // answer at the time this was checked. This is exactly why the
  // events below never rely on this having worked — see
  // correlate.ts's own comment on the defensive fallback that exists
  // specifically for that.
  if (eventType === "subscription.create") {
    try {
      const d = data as Record<string, unknown>;
      const subscriptionCode = typeof d.subscription_code === "string" ? d.subscription_code : null;
      if (!subscriptionCode) {
        console.error(`subscription.create for reference ${reference} had no subscription_code — see this handler's own comment on why that's a real, acknowledged uncertainty.`);
      } else {
        const enrollment = await findEnrollmentForSubscriptionEvent(d, false);
        if (enrollment) {
          await prisma.courseEnrollment.update({
            where: { id: enrollment.id },
            data: { paystackSubscriptionCode: subscriptionCode },
          });
        } else {
          console.error(`subscription.create for reference ${reference}: no matching enrollment found to record subscription_code ${subscriptionCode} against.`);
        }
      }
    } catch (e) {
      console.error(`subscription.create handling failed for reference ${reference}:`, e);
    }
  }

  // M27 — the actual "won't renew" notice. NOT a revocation trigger —
  // this is the single most important distinction this whole milestone
  // exists to get right, confirmed directly against Paystack's own
  // documentation before writing anything: cancelling a subscription
  // fires this event immediately, then access should continue until
  // the ALREADY-PAID period genuinely ends, at which point (and only
  // then) `subscription.disable` fires below. Revoking access here
  // instead would take away time a trainee already paid for.
  if (eventType === "subscription.not_renew") {
    try {
      const enrollment = await findEnrollmentForSubscriptionEvent(data as Record<string, unknown>, true);
      if (!enrollment) {
        console.error(`subscription.not_renew for reference ${reference}: no matching enrollment found.`);
      } else {
        const [trainee, course, enrollmentRow] = await Promise.all([
          prisma.trainee.findUnique({ where: { id: enrollment.traineeId } }),
          prisma.course.findUnique({ where: { id: enrollment.courseId }, select: { title: true } }),
          prisma.courseEnrollment.findUnique({ where: { id: enrollment.id }, select: { currentPeriodEnd: true } }),
        ]);
        if (trainee && course && shouldNotifyTrainee(trainee)) {
          const appUrl = process.env.APP_URL ?? "http://localhost:3000";
          const relativeUrl = `/trainee/courses/${enrollment.courseId}`;
          const content = subscriptionEndingEmail({
            traineeName: trainee.name,
            courseTitle: course.title,
            accessUntil: enrollmentRow?.currentPeriodEnd?.toLocaleDateString() ?? "the end of your current period",
            courseUrl: `${appUrl}${relativeUrl}`,
          });
          await notifyByEmail({
            recipientType: "TRAINEE",
            recipientId: enrollment.traineeId,
            to: trainee.email,
            type: "SUBSCRIPTION_ENDING",
            relatedId: enrollment.courseId,
            // Same audit sweep — click takes the trainee to the course
            // whose access is about to end.
            url: relativeUrl,
            subject: content.subject,
            html: content.html,
            text: content.text,
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error(`subscription.not_renew handling failed for reference ${reference}:`, e);
    }
  }

  // M27 — the actual, authoritative revoke-access trigger, and the
  // single most important handler in this whole milestone, per the
  // roadmap's own framing: this fires both when a cancelled
  // subscription's already-paid period genuinely ends, AND when a
  // failed renewal's retries are ultimately exhausted (Paystack
  // retries automatically over several days before giving up — see
  // invoice.payment_failed below, which deliberately does NOT revoke
  // on its own). Both cases converge on this one event as the correct
  // moment to actually act.
  if (eventType === "subscription.disable") {
    try {
      const enrollment = await findEnrollmentForSubscriptionEvent(data as Record<string, unknown>, true);
      if (!enrollment) {
        // Never a silent miss for the most consequential event this
        // webhook handles — a real staff member needs to be able to
        // find this in logs and manually revoke access if correlation
        // genuinely failed, rather than access quietly continuing
        // forever with no billing behind it.
        console.error(`ACTION NEEDED: subscription.disable for reference ${reference} could not be correlated to any enrollment — access was NOT revoked automatically. Manual staff review required.`);
      } else {
        await prisma.courseEnrollment.update({
          where: { id: enrollment.id },
          data: { accessRevokedAt: new Date() },
        });
        const [trainee, course] = await Promise.all([
          prisma.trainee.findUnique({ where: { id: enrollment.traineeId } }),
          prisma.course.findUnique({ where: { id: enrollment.courseId }, select: { title: true } }),
        ]);
        if (trainee && course && shouldNotifyTrainee(trainee)) {
          const appUrl = process.env.APP_URL ?? "http://localhost:3000";
          const relativeUrl = `/trainee/courses/${enrollment.courseId}`;
          const content = subscriptionEndedEmail({
            traineeName: trainee.name,
            courseTitle: course.title,
            courseUrl: `${appUrl}${relativeUrl}`,
          });
          await notifyByEmail({
            recipientType: "TRAINEE",
            recipientId: enrollment.traineeId,
            to: trainee.email,
            type: "SUBSCRIPTION_ENDED",
            relatedId: enrollment.courseId,
            // Same audit sweep — click takes the trainee back to the
            // course whose access just ended.
            url: relativeUrl,
            subject: content.subject,
            html: content.html,
            text: content.text,
          }).catch(() => {});
        }
        console.log(`Course access revoked: trainee ${enrollment.traineeId}, course ${enrollment.courseId}, reference ${reference}.`);
      }
    } catch (e) {
      console.error(`subscription.disable handling failed for reference ${reference}:`, e);
    }
  }

  // M27 — a courtesy notice only, deliberately NOT a revocation
  // trigger. Confirmed directly: Paystack automatically retries a
  // failed renewal charge over the following days on its own; revoking
  // access on the FIRST failure would very plausibly cut someone off
  // over a temporary card issue that resolves itself on retry.
  // subscription.disable above is what actually fires once retries are
  // genuinely exhausted — this handler's only job is letting the
  // trainee know early enough to update their card before that
  // happens.
  if (eventType === "invoice.payment_failed") {
    try {
      const enrollment = await findEnrollmentForSubscriptionEvent(data as Record<string, unknown>, false);
      if (!enrollment) {
        console.error(`invoice.payment_failed for reference ${reference}: no matching enrollment found — no notification sent.`);
      } else {
        const [trainee, course] = await Promise.all([
          prisma.trainee.findUnique({ where: { id: enrollment.traineeId } }),
          prisma.course.findUnique({ where: { id: enrollment.courseId }, select: { title: true } }),
        ]);
        if (trainee && course && shouldNotifyTrainee(trainee)) {
          const appUrl = process.env.APP_URL ?? "http://localhost:3000";
          const relativeUrl = `/trainee/courses/${enrollment.courseId}`;
          const content = paymentFailedEmail({
            traineeName: trainee.name,
            courseTitle: course.title,
            courseUrl: `${appUrl}${relativeUrl}`,
          });
          await notifyByEmail({
            recipientType: "TRAINEE",
            recipientId: enrollment.traineeId,
            to: trainee.email,
            type: "PAYMENT_FAILED",
            relatedId: enrollment.courseId,
            // Same audit sweep — click takes the trainee back to the
            // course so they can retry payment.
            url: relativeUrl,
            subject: content.subject,
            html: content.html,
            text: content.text,
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error(`invoice.payment_failed handling failed for reference ${reference}:`, e);
    }
  }

  return NextResponse.json({ received: true });
}
