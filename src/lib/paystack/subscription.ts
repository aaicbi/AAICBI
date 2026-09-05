/**
 * M26 — Payment Initiation. Lazy Plan creation (no Paystack Plan
 * exists for a course until the first real payment attempt for it)
 * and the actual transaction-initialize call that produces the
 * checkout URL a trainee gets redirected to.
 *
 * Verified directly against Paystack's current documentation before
 * writing this: `POST /plan` with {name, amount, interval}, and the
 * simplest way to create a subscription is including that plan's code
 * directly in the SAME `/transaction/initialize` call — no separate
 * "create subscription" step needed at initiation time.
 *
 * Honest note on what could and couldn't be verified: both calls here
 * hit a real external API this sandbox has no network access to and
 * no credentials for — written correctly against Paystack's documented
 * shapes, the same "built correctly, not verified end-to-end from
 * here" category as every other external integration in this project.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const INTERVAL_MAP: Record<string, string> = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUALLY: "annually",
};

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set — see DEPLOYMENT.md. Required for any real payment action.");
  }
  return key;
}

const PlanCreateResponseSchema = z.object({
  status: z.boolean(),
  data: z.object({ plan_code: z.string() }),
});

/**
 * Get-or-create — the plan code already stored on the course is used
 * as-is if present; a fresh Plan is only ever created the first time a
 * course is actually paid for, or again after the coursePricing
 * update route has reset the stored code because price or interval
 * changed (see that route's own comment).
 *
 * A low-severity, deliberately accepted race, not overlooked: two
 * near-simultaneous first payment attempts for the same never-before-
 * paid course could both see no stored plan code and both create one
 * in Paystack. Worst case is one harmless orphaned extra Plan sitting
 * in the Paystack dashboard — not a security or correctness issue, so
 * building full request-level locking for it isn't worth the
 * complexity it would add.
 */
export async function getOrCreatePlanForCourse(course: {
  id: string;
  title: string;
  priceKobo: number | null;
  billingInterval: string | null;
  paystackPlanCode: string | null;
}): Promise<string> {
  if (course.paystackPlanCode) return course.paystackPlanCode;
  if (!course.priceKobo || !course.billingInterval) {
    throw new Error(`Course ${course.id} is missing price or billing interval — cannot create a Paystack plan for it.`);
  }

  const res = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: course.title,
      amount: course.priceKobo,
      interval: INTERVAL_MAP[course.billingInterval],
      // Explicit, not left to the account's default — see this file's
      // own comment on `initializeCoursePayment` below for the real
      // risk this closes.
      currency: "NGN",
    }),
  });
  if (!res.ok) {
    throw new Error(`Paystack plan creation failed: ${res.status} ${await res.text()}`);
  }
  const parsed = PlanCreateResponseSchema.safeParse(await res.json());
  if (!parsed.success || !parsed.data.status) {
    throw new Error("Paystack plan creation returned an unexpected response.");
  }

  await prisma.course.update({ where: { id: course.id }, data: { paystackPlanCode: parsed.data.data.plan_code } });
  return parsed.data.data.plan_code;
}

const TransactionInitResponseSchema = z.object({
  status: z.boolean(),
  data: z.object({ authorization_url: z.string(), reference: z.string() }),
});

export async function initializeCoursePayment(
  trainee: { id: string; email: string },
  course: { id: string; title: string; priceKobo: number | null; billingInterval: string | null; paystackPlanCode: string | null }
): Promise<{ authorizationUrl: string; reference: string }> {
  const planCode = await getOrCreatePlanForCourse(course);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: trainee.email,
      amount: course.priceKobo,
      // Audit finding, fixed here: confirmed directly against a
      // dedicated guide on this exact Paystack integration risk, not
      // assumed — omitting `currency` means Paystack falls back to the
      // account's default, which is fine until it isn't; a genuine
      // real-world exploit this guide describes is initializing an
      // amount in one currency while the verification step only checks
      // the numeric value, letting a wildly different real-world
      // amount pass (e.g. an amount of 500000 is a completely
      // different value in NGN kobo versus USD cents). This platform
      // only ever intends NGN — `Course.priceKobo`'s own schema
      // comment already says so — made explicit here rather than
      // relying on account configuration to always agree, and checked
      // again on the verification side in `isGenuinePaymentSuccess`.
      currency: "NGN",
      plan: planCode,
      callback_url: `${appUrl}/trainee/courses/${course.id}/payment-callback`,
      // Read back verbatim in the charge.success webhook — this is
      // the actual mechanism that correlates a confirmed payment back
      // to who to enroll and in what, without ever needing a "pending
      // enrollment" row that an abandoned checkout would leave stale
      // and stuck. Confirmed directly across multiple independent,
      // real integration guides before designing around it, not
      // assumed.
      //
      // amountKobo included here specifically — a real bug this
      // closes: checking a webhook's amount against the course's
      // CURRENT price (re-fetched fresh when the webhook arrives)
      // breaks the moment price changes between initiation and
      // confirmation. A trainee who paid the price genuinely in effect
      // at checkout, whose payment then gets compared against a price
      // an admin changed minutes later, would have a real, successful
      // payment wrongly rejected. Recording what was ACTUALLY charged
      // at initiation time, and verifying against that fixed value
      // instead of the course's live price, is what makes this
      // correct regardless of when a price change happens to land.
      metadata: { traineeId: trainee.id, courseId: course.id, amountKobo: course.priceKobo },
    }),
  });
  if (!res.ok) {
    throw new Error(`Paystack transaction initialize failed: ${res.status} ${await res.text()}`);
  }
  const parsed = TransactionInitResponseSchema.safeParse(await res.json());
  if (!parsed.success || !parsed.data.status) {
    throw new Error("Paystack transaction initialize returned an unexpected response.");
  }

  return { authorizationUrl: parsed.data.data.authorization_url, reference: parsed.data.data.reference };
}
