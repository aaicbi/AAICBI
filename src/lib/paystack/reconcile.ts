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
 *
 * Course enrollment/subscription system — extended with two additive
 * pieces, neither of which changes the `needsOtp` branching above:
 * (1) `course.accessModel` now decides which of two pure functions
 * computes `currentPeriodEnd` (see billingPeriod.ts's own comment on
 * why these are two separate functions, not one overloaded one);
 * (2) every call now keeps the structured `Payment` ledger in sync
 * (PENDING→SUCCESS/FAILED), and a renewal that lands suspiciously
 * early relative to its own cycle length flags admin staff via the
 * previously-unwired `likelyDuplicatePaymentEmail`.
 */
import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction, isGenuinePaymentSuccess } from "@/lib/paystack/client";
import { computePeriodEnd, computeFixedAccessEnd } from "@/lib/paystack/billingPeriod";
import { generateOtpCode, OTP_EXPIRY_MINUTES } from "@/lib/paystack/otp";
import { notifyByEmail } from "@/lib/notifications/log";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { paymentOtpEmail, likelyDuplicatePaymentEmail, paymentReceiptEmail } from "@/lib/notifications/templates";
import { grantAiCreditsForPayment } from "@/lib/paystack/aiCredits";

export type ProcessChargeResult =
  | { status: "granted"; traineeId: string; courseId: string }
  | { status: "otp_issued"; traineeId: string; courseId: string }
  | { status: "no_metadata" }
  | { status: "invalid_course"; courseId: string }
  | { status: "not_genuine"; detail: string; traineeId: string; courseId: string };

type PaidCourse = {
  id: string;
  title: string;
  accessModel: "RECURRING_SUBSCRIPTION" | "FIXED_DURATION";
  billingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
  accessDurationValue: number | null;
  accessDurationUnit: "DAYS" | "MONTHS" | "LIFETIME" | null;
};

/**
 * A rough cycle length in days — used only to judge whether a renewal
 * landed suspiciously early (the duplicate-payment check below), never
 * for computing real access dates (that's computePeriodEnd/
 * computeFixedAccessEnd's job). Month-length approximation is fine for
 * this purpose. Null means "no cycle to compare against" (LIFETIME, or
 * a malformed config that already failed the invalid_course check
 * before this is ever called).
 */
function approximateCycleDays(course: PaidCourse): number | null {
  if (course.accessModel === "RECURRING_SUBSCRIPTION") {
    switch (course.billingInterval) {
      case "MONTHLY":
        return 30;
      case "QUARTERLY":
        return 91;
      case "ANNUALLY":
        return 365;
      default:
        return null;
    }
  }
  if (course.accessDurationUnit === "DAYS") return course.accessDurationValue;
  if (course.accessDurationUnit === "MONTHS") return (course.accessDurationValue ?? 0) * 30;
  return null; // LIFETIME
}

/**
 * Course enrollment/subscription system — the actual payment receipt
 * (task Section 12), sent on every genuine successful charge, first
 * purchase and renewal alike; see paymentReceiptEmail's own comment for
 * why this didn't exist before and why it's a separate email from the
 * OTP unlock code. Shared here so the two call sites below (needsOtp
 * and renewal) can't drift on what a receipt actually contains.
 *
 * `currentPeriodEnd` doubles as both "when does this one-time payment's
 * access end" (FIXED_DURATION) and "when will the next automatic charge
 * happen" (RECURRING_SUBSCRIPTION) — courseAccessModel decides which of
 * those two honest framings the email actually uses; never both.
 */
async function sendPaymentReceipt(params: {
  trainee: { id: string; name: string; email: string };
  course: PaidCourse;
  courseId: string;
  reference: string;
  amountKobo: number;
  method: string | null;
  paidAt: Date;
  currentPeriodEnd: Date | null;
  relatedId: string;
}): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const relativeUrl = `/trainee/courses/${params.courseId}`;
  const isRecurring = params.course.accessModel === "RECURRING_SUBSCRIPTION";

  const content = paymentReceiptEmail({
    traineeName: params.trainee.name,
    courseTitle: params.course.title,
    amountKobo: params.amountKobo,
    reference: params.reference,
    paidAt: params.paidAt.toLocaleDateString(),
    method: params.method,
    nextBillingDate: isRecurring && params.currentPeriodEnd ? params.currentPeriodEnd.toLocaleDateString() : null,
    nextBillingAmountKobo: isRecurring && params.currentPeriodEnd ? params.amountKobo : null,
    accessUntil: !isRecurring && params.currentPeriodEnd ? params.currentPeriodEnd.toLocaleDateString() : null,
    courseUrl: `${appUrl}${relativeUrl}`,
  });
  await notifyByEmail({
    recipientType: "TRAINEE",
    recipientId: params.trainee.id,
    to: params.trainee.email,
    type: "PAYMENT_RECEIPT",
    relatedId: params.relatedId,
    url: relativeUrl,
    subject: content.subject,
    html: content.html,
    text: content.text,
  }).catch((e) => console.error(`Failed to send payment receipt for trainee ${params.trainee.id}, course ${params.courseId}:`, e));
}

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
    select: {
      id: true,
      title: true,
      accessModel: true,
      billingInterval: true,
      accessDurationValue: true,
      accessDurationUnit: true,
    },
  });
  const paidConfigValid =
    course &&
    (course.accessModel === "RECURRING_SUBSCRIPTION" ? course.billingInterval !== null : course.accessDurationUnit !== null);
  if (!course || !paidConfigValid) {
    console.error(`charge.success reference ${reference} references course ${courseId}, which is missing or not a paid course.`);
    return { status: "invalid_course", courseId };
  }

  // Course enrollment/subscription system — keep the structured
  // Payment ledger in sync regardless of outcome. Upsert (not create)
  // tolerates the row already existing from POST /api/courses/[id]/pay's
  // own initiation-time write, or not existing at all (a webhook for a
  // reference this app never itself wrote a PENDING row for shouldn't
  // be fatal here).
  await prisma.payment
    .upsert({
      where: { reference },
      create: { traineeId, courseId, reference, amountKobo: expectedAmountKobo, currency: verified.data.currency },
      update: {},
    })
    .catch((e) => console.error(`Failed to upsert Payment record for reference ${reference}:`, e));

  if (!isGenuinePaymentSuccess(verified, expectedAmountKobo)) {
    const detail = `expected ${expectedAmountKobo} kobo, got status=${verified.data.status} amount=${verified.data.amount}`;
    console.error(`charge.success reference ${reference} failed the genuine-success check — ${detail}. No access granted.`);
    await prisma.payment
      .update({ where: { reference }, data: { status: "FAILED", failedAt: new Date() } })
      .catch((e) => console.error(`Failed to mark Payment FAILED for reference ${reference}:`, e));
    return { status: "not_genuine", detail, traineeId, courseId };
  }

  const now = new Date();
  const currentPeriodEnd =
    course.accessModel === "RECURRING_SUBSCRIPTION"
      ? computePeriodEnd(now, course.billingInterval as "MONTHLY" | "QUARTERLY" | "ANNUALLY")
      : computeFixedAccessEnd(now, course.accessDurationValue, course.accessDurationUnit as "DAYS" | "MONTHS" | "LIFETIME");
  const customerCode = verified.data.customer?.customer_code ?? null;
  const method = verified.data.channel ?? null;

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

    await prisma.payment
      .update({ where: { reference }, data: { status: "SUCCESS", confirmedAt: now, method, enrollmentId: enrollment.id } })
      .catch((e) => console.error(`Failed to mark Payment SUCCESS for reference ${reference}:`, e));

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

      await sendPaymentReceipt({
        trainee,
        course,
        courseId,
        reference,
        amountKobo: expectedAmountKobo,
        method,
        paidAt: now,
        currentPeriodEnd,
        relatedId: enrollment.id,
      });
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
    // Captured before it's overwritten below — the whole basis of the
    // duplicate-payment check just after.
    const previousPeriodEnd = existing!.currentPeriodEnd;

    const enrollment = await prisma.courseEnrollment.update({
      where: { id: existing!.id },
      data: {
        source: "PAID",
        accessRevokedAt: null,
        paystackCustomerCode: customerCode,
        paystackSubscriptionCode: null,
        currentPeriodEnd,
      },
    });

    await prisma.payment
      .update({ where: { reference }, data: { status: "SUCCESS", confirmedAt: now, method, enrollmentId: enrollment.id } })
      .catch((e) => console.error(`Failed to mark Payment SUCCESS for reference ${reference}:`, e));

    const trainee = await prisma.trainee.findUnique({ where: { id: traineeId } });
    if (trainee) {
      await sendPaymentReceipt({
        trainee,
        course,
        courseId,
        reference,
        amountKobo: expectedAmountKobo,
        method,
        paidAt: now,
        currentPeriodEnd,
        relatedId: enrollment.id,
      });
    }

    // Course enrollment/subscription system — a renewal landing with
    // MORE than a quarter of its own cycle still remaining on the
    // PREVIOUS period is a real signal of an accidental double-charge
    // (a double-click, two tabs both completing checkout), not a
    // genuine early renewal — see likelyDuplicatePaymentEmail's own
    // doc comment for the full reasoning. Proportional to the course's
    // own cycle length, not a flat day count: 5 days early is
    // unremarkable for an ANNUALLY course, suspicious for a MONTHLY
    // one. Never fires for LIFETIME access (no cycle, no
    // previousPeriodEnd to compare).
    if (previousPeriodEnd && trainee) {
      const cycleDays = approximateCycleDays(course);
      if (cycleDays) {
        const daysRemaining = (previousPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysRemaining > cycleDays * 0.25) {
          const content = likelyDuplicatePaymentEmail({
            traineeName: trainee.name,
            traineeEmail: trainee.email,
            courseTitle: course.title,
            newReference: reference,
            currentPeriodEnd: previousPeriodEnd.toLocaleDateString(),
          });
          await notifyAllAdminStaff("LIKELY_DUPLICATE_PAYMENT", enrollment.id, content, `/admin/courses/${courseId}/enrollments`).catch(
            (e) => console.error(`Failed to send duplicate-payment alert for trainee ${traineeId}:`, e)
          );
        }
      }
    }

    console.log(`Course access extended (already unlocked): trainee ${traineeId}, course ${courseId}, reference ${reference}.`);
    await grantAiCreditsForPayment(traineeId, courseId);
    return { status: "granted", traineeId, courseId };
  }
}
