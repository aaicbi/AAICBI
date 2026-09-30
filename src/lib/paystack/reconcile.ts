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
 * pieces: (1) `course.accessModel` now decides which of two pure functions
 * computes `currentPeriodEnd` (see billingPeriod.ts's own comment on
 * why these are two separate functions, not one overloaded one);
 * (2) every call now keeps the structured `Payment` ledger in sync
 * (PENDING→SUCCESS/FAILED), and a renewal that lands suspiciously
 * early relative to its own cycle length flags admin staff via the
 * previously-unwired `likelyDuplicatePaymentEmail`.
 */
import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction, isGenuinePaymentSuccess, PaystackVerifyResult } from "@/lib/paystack/client";
import { computePeriodEnd, computeFixedAccessEnd } from "@/lib/paystack/billingPeriod";
import { notifyByEmail } from "@/lib/notifications/log";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { likelyDuplicatePaymentEmail, paymentReceiptEmail } from "@/lib/notifications/templates";
import { grantAiCreditsForPayment } from "@/lib/paystack/aiCredits";
import { getEffectivePriceKobo } from "@/lib/coursePricing";

export type ProcessChargeResult =
  | { status: "granted"; traineeId: string; courseId: string }
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
  priceKobo: number | null;
  discountPercent: number | null;
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
 * purchase and renewal alike — now the sole "you now have access"
 * communication for a paid course, since the separate OTP-unlock email
 * this once complemented no longer exists (see processConfirmedCharge's
 * own comment). It already links straight to the course, so nothing
 * else was needed once OTP was removed.
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
  const appUrl = process.env.APP_URL ?? "https://aaicbi.org";
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
    originalPriceKobo: params.course.priceKobo,
    discountPercent: params.course.discountPercent,
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

/**
 * Real incident, not a hypothetical: a trainee who abandons the "Card"
 * option on Paystack's hosted checkout and pays via Bank Transfer
 * instead ends up on a genuinely separate Paystack charge object, one
 * that doesn't inherit the custom `metadata` (traineeId, courseId,
 * amountKobo) initializeCoursePayment set on the original transaction —
 * confirmed directly against two real production webhook payloads,
 * both `charge.success`, both `channel: "bank_transfer"`, both carrying
 * only `metadata: { referrer: "<course page URL>" }`. Paystack still
 * reliably attaches two other things to every charge, though: the
 * verified customer's email, and — via `callback_url` — the same course
 * page URL as `referrer`. That's enough to re-derive both IDs without
 * trusting anything client-supplied, and the amount is computed fresh
 * from the course's own current price rather than read back from
 * metadata at all, which is strictly safer than what the primary path
 * above does.
 *
 * Returns null when even this can't resolve anything (no referrer, no
 * matching trainee, no matching course) — callers fall through to the
 * existing `no_metadata` outcome exactly as before.
 */
async function resolveFromVerifiedCharge(
  verified: PaystackVerifyResult
): Promise<{ traineeId: string; courseId: string; expectedAmountKobo: number } | null> {
  const metadata = verified.data.metadata;
  const referrer = metadata && typeof metadata.referrer === "string" ? metadata.referrer : null;
  const courseIdMatch = referrer?.match(/\/courses\/([a-zA-Z0-9]+)/);
  const courseId = courseIdMatch ? courseIdMatch[1] : null;
  const customerEmail = verified.data.customer?.email ?? null;
  if (!courseId || !customerEmail) return null;

  const trainee = await prisma.trainee.findUnique({ where: { email: customerEmail }, select: { id: true } });
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { priceKobo: true, discountPercent: true },
  });
  if (!trainee || !course) return null;

  const expectedAmountKobo = getEffectivePriceKobo(course);
  if (expectedAmountKobo === null) return null;

  console.log(
    `Reference ${verified.data.reference}: Paystack's own metadata was incomplete (likely a Bank Transfer sub-charge) — resolved trainee ${trainee.id} and course ${courseId} via customer email + referrer instead.`
  );
  return { traineeId: trainee.id, courseId, expectedAmountKobo };
}

export async function processConfirmedCharge(reference: string): Promise<ProcessChargeResult> {
  const verified = await verifyPaystackTransaction(reference);

  const metadata = verified.data.metadata;
  const metaTraineeId = metadata && typeof metadata.traineeId === "string" ? metadata.traineeId : null;
  const metaCourseId = metadata && typeof metadata.courseId === "string" ? metadata.courseId : null;
  const metaAmountKobo = metadata && typeof metadata.amountKobo === "number" ? metadata.amountKobo : null;

  const resolved =
    metaTraineeId && metaCourseId && metaAmountKobo !== null
      ? { traineeId: metaTraineeId, courseId: metaCourseId, expectedAmountKobo: metaAmountKobo }
      : await resolveFromVerifiedCharge(verified);

  if (!resolved) {
    console.error(`charge.success for reference ${reference} has no usable metadata — cannot activate anything.`);
    return { status: "no_metadata" };
  }
  const { traineeId, courseId, expectedAmountKobo } = resolved;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      accessModel: true,
      billingInterval: true,
      accessDurationValue: true,
      accessDurationUnit: true,
      priceKobo: true,
      discountPercent: true,
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
  // Instant-unlock policy: a confirmed payment grants access the same
  // moment FREE and ADMIN_GRANTED already do (see CourseEnrollment.
  // unlockedAt's own schema comment) — no OTP step in between anymore.
  // Removed by direct request after a real payment left a trainee
  // stuck with nothing to show for it: the OTP's own justification
  // ("access isn't real until confirmed, not merely because Paystack
  // said so") added a genuine point of failure — an email that's slow,
  // filtered to spam, or never opened — for a trainee whose money has
  // already cleared, with no real security benefit (the payer is
  // already the authenticated, logged-in trainee; the OTP never
  // verified anything requireRole("TRAINEE") on POST /api/courses/[id]/pay
  // hadn't already). `existing.unlockedAt ?? now` preserves the real
  // first-unlock date on a renewal — never re-derived, same "historical
  // fact, not recomputed" treatment this schema already gives
  // Certificate.issuedAt and Attempt.passed.
  const previousPeriodEnd = existing?.currentPeriodEnd ?? null;
  const isRenewal = !!existing?.unlockedAt;

  const enrollment = existing
    ? await prisma.courseEnrollment.update({
        where: { id: existing.id },
        data: {
          source: "PAID",
          accessRevokedAt: null,
          unlockedAt: existing.unlockedAt ?? now,
          paystackCustomerCode: customerCode,
          paystackSubscriptionCode: null,
          currentPeriodEnd,
        },
      })
    : await prisma.courseEnrollment.create({
        data: {
          traineeId,
          courseId,
          source: "PAID",
          unlockedAt: now,
          paystackCustomerCode: customerCode,
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

    const adminContent = {
      subject: `${isRenewal ? "Payment / Renewal" : "New Payment"} Received: ${course.title}`,
      html: `<p>Trainee <strong>${trainee.name}</strong> (${trainee.email}) paid ₦${(expectedAmountKobo / 100).toLocaleString()} for <strong>${course.title}</strong> (Ref: ${reference}).</p>`,
      text: `Trainee ${trainee.name} (${trainee.email}) paid ₦${(expectedAmountKobo / 100).toLocaleString()} for ${course.title} (Ref: ${reference}).`,
    };
    await notifyAllAdminStaff("PAYMENT_RECEIPT", enrollment.id, adminContent, "/admin/payments").catch(
      (e) => console.error(`Failed to send admin payment notification for reference ${reference}:`, e)
    );

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
    if (previousPeriodEnd) {
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
  }

  console.log(`Course access unlocked immediately: trainee ${traineeId}, course ${courseId}, reference ${reference}.`);
  // M45 — every successful paid charge grants a fresh batch of AI
  // credits, both the first payment and every renewal, matching the
  // word "subscription" in this milestone's own scope: credits
  // refresh each billing cycle, same as the subscription itself.
  // Wrapped internally so a failure here never affects the payment
  // activation above — see that function's own comment.
  await grantAiCreditsForPayment(traineeId, courseId);
  return { status: "granted", traineeId, courseId };
}
