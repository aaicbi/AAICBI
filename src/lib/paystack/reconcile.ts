/**
 * M29 — the actual "grant access from a confirmed payment" logic,
 * extracted here so both the webhook (M25) and the new reconciliation
 * route below can call the exact same code, rather than two copies
 * that could quietly drift apart. Deliberately a mechanical extraction
 * of the webhook's own already-audited `charge.success` handling, not
 * a rewrite — this exact logic has already been through several real
 * audit passes (the price-drift bug, the OTP retrofit, the stale-
 * subscription-code fix), and reproducing it faithfully here matters
 * more than restyling it.
 *
 * Takes a bare reference, not a webhook payload — this is what makes
 * it callable from a context (a trainee clicking "recheck my
 * payment") that never received a webhook at all, which is the entire
 * point of this milestone: a trainee whose CourseEnrollment never got
 * the confirming event, for whatever network reason, has a real way
 * to check directly with Paystack instead of being stuck with nothing
 * to show for a real payment and no recourse but contacting support.
 */
import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction, isGenuinePaymentSuccess } from "@/lib/paystack/client";
import { computePeriodEnd } from "@/lib/paystack/billingPeriod";
import { generateOtpCode, OTP_EXPIRY_MINUTES } from "@/lib/paystack/otp";
import { notifyByEmail } from "@/lib/notifications/log";
import { paymentOtpEmail } from "@/lib/notifications/templates";
import { grantAiCreditsForPayment } from "@/lib/paystack/aiCredits";

export type ProcessChargeResult =
  | { status: "granted"; traineeId: string; courseId: string }
  | { status: "otp_issued"; traineeId: string; courseId: string }
  | { status: "no_metadata" }
  | { status: "invalid_course"; courseId: string }
  | { status: "not_genuine"; detail: string; traineeId: string; courseId: string };

export async function processConfirmedCharge(reference: string): Promise<ProcessChargeResult> {
  const verified = await verifyPaystackTransaction(reference);

  const metadata = verified.data.metadata;
  const traineeId = metadata && typeof metadata.traineeId === "string" ? metadata.traineeId : null;
  const courseId = metadata && typeof metadata.courseId === "string" ? metadata.courseId : null;
  const expectedAmountKobo = metadata && typeof metadata.amountKobo === "number" ? metadata.amountKobo : null;

  if (!traineeId || !courseId || expectedAmountKobo === null) {
    console.error(`charge.success for reference ${reference} has no usable metadata — cannot activate anything.`);
    return { status: "no_metadata" };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, billingInterval: true },
  });
  if (!course || !course.billingInterval) {
    console.error(`charge.success reference ${reference} references course ${courseId}, which is missing or not a paid course.`);
    return { status: "invalid_course", courseId };
  }
  if (!isGenuinePaymentSuccess(verified, expectedAmountKobo)) {
    const detail = `expected ${expectedAmountKobo} kobo, got status=${verified.data.status} amount=${verified.data.amount}`;
    console.error(`charge.success reference ${reference} failed the genuine-success check — ${detail}. No access granted.`);
    return { status: "not_genuine", detail, traineeId, courseId };
  }

  const now = new Date();
  const currentPeriodEnd = computePeriodEnd(now, course.billingInterval as "MONTHLY" | "QUARTERLY" | "ANNUALLY");
  const customerCode = verified.data.customer?.customer_code ?? null;

  const existing = await prisma.courseEnrollment.findUnique({
    where: { traineeId_courseId: { traineeId, courseId } },
  });
  const needsOtp = !existing || !existing.unlockedAt;

  if (needsOtp) {
    const otpCode = generateOtpCode();
    const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const enrollment = existing
      ? await prisma.courseEnrollment.update({
          where: { id: existing.id },
          data: {
            source: "PAID",
            accessRevokedAt: null,
            paystackCustomerCode: customerCode,
            paystackSubscriptionCode: null,
            currentPeriodEnd,
            otpCode,
            otpExpiresAt,
          },
        })
      : await prisma.courseEnrollment.create({
          data: {
            traineeId,
            courseId,
            source: "PAID",
            paystackCustomerCode: customerCode,
            currentPeriodEnd,
            otpCode,
            otpExpiresAt,
          },
        });

    const trainee = await prisma.trainee.findUnique({ where: { id: traineeId } });
    if (trainee) {
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const content = paymentOtpEmail({
        traineeName: trainee.name,
        courseTitle: course.title ?? "your course",
        otpCode,
        verifyUrl: `${appUrl}/trainee/courses/${courseId}/unlock?code=${otpCode}`,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      });
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: traineeId,
        to: trainee.email,
        type: "PAYMENT_OTP",
        relatedId: enrollment.id,
        subject: content.subject,
        html: content.html,
        text: content.text,
        // M43 — arguably the single most valuable of the five named
        // events to actually reach WhatsApp: a trainee who just paid
        // real money wants this code the moment it's available, and a
        // second delivery path matters more here than anywhere else.
        // The code is sent in plain text, matching what the email
        // itself already does — see paymentOtpEmail's own design; this
        // isn't a new trust boundary, just a second channel for the
        // same already-established one.
        whatsapp: { templateName: "payment_otp", variables: { name: trainee.name, code: otpCode } },
      }).catch((e) => console.error(`Failed to send OTP email for trainee ${traineeId}, course ${courseId}:`, e));
    }
    console.log(`OTP issued for trainee ${traineeId}, course ${courseId}, reference ${reference} — awaiting verification before unlocking.`);
    // M45 — every successful paid charge grants a fresh batch of AI
    // credits, both the first payment and every renewal, matching the
    // word "subscription" in this milestone's own scope: credits
    // refresh each billing cycle, same as the subscription itself.
    // Wrapped internally so a failure here never affects the payment
    // activation above — see that function's own comment.
    await grantAiCreditsForPayment(traineeId, courseId);
    return { status: "otp_issued", traineeId, courseId };
  } else {
    await prisma.courseEnrollment.update({
      where: { id: existing!.id },
      data: {
        source: "PAID",
        accessRevokedAt: null,
        paystackCustomerCode: customerCode,
        paystackSubscriptionCode: null,
        currentPeriodEnd,
      },
    });
    console.log(`Course access extended (already unlocked): trainee ${traineeId}, course ${courseId}, reference ${reference}.`);
    await grantAiCreditsForPayment(traineeId, courseId);
    return { status: "granted", traineeId, courseId };
  }
}
