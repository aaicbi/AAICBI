/**
 * Direct platform-fee billing — the organization-side counterpart to
 * subscription.ts's getOrCreatePlanForCourse/initializeCoursePayment,
 * mirrored deliberately rather than generalized into one shared
 * function: the "subject" being billed (a TrainingOrganization paying
 * AAICBI directly) is structurally different from a trainee paying for
 * a course, and keeping them as two parallel, independently-readable
 * pipelines matches how cleanly separated correlate.ts/reconcile.ts
 * already are from their org-billing counterparts (correlateOrgBilling.ts,
 * reconcileOrgBilling.ts).
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

type BillableOrg = {
  id: string;
  name: string;
  email: string;
  platformFeeKobo: number | null;
  platformFeeBillingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
  platformFeePaystackPlanCode: string | null;
};

/**
 * Get-or-create, same shape and same deliberately-accepted race as
 * getOrCreatePlanForCourse: two near-simultaneous first payment
 * attempts could both create a Plan, leaving one harmless orphan in the
 * Paystack dashboard — not worth real locking to prevent.
 */
export async function getOrCreatePlatformFeePlan(org: BillableOrg): Promise<string> {
  if (org.platformFeePaystackPlanCode) return org.platformFeePaystackPlanCode;
  if (!org.platformFeeKobo || !org.platformFeeBillingInterval) {
    throw new Error(`Training organization ${org.id} has no platform fee/interval set — cannot create a Paystack plan.`);
  }

  const res = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `AAICBI Platform Fee — ${org.name}`,
      amount: org.platformFeeKobo,
      interval: INTERVAL_MAP[org.platformFeeBillingInterval],
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

  await prisma.trainingOrganization.update({
    where: { id: org.id },
    data: { platformFeePaystackPlanCode: parsed.data.data.plan_code },
  });
  return parsed.data.data.plan_code;
}

const TransactionInitResponseSchema = z.object({
  status: z.boolean(),
  data: z.object({
    authorization_url: z.string(),
    access_code: z.string().optional(),
    reference: z.string(),
  }),
});

export async function initializePlatformFeePayment(
  org: BillableOrg
): Promise<{ authorizationUrl: string; accessCode?: string; reference: string }> {
  const appUrl = process.env.APP_URL ?? "https://aaicbi.org";
  const planCode = await getOrCreatePlatformFeePlan(org);

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: org.email,
      amount: org.platformFeeKobo,
      currency: "NGN",
      plan: planCode,
      callback_url: `${appUrl}/org/billing/payment-callback`,
      // Read back by processConfirmedPlatformFeeCharge (reconcileOrgBilling.ts)
      // and by reconcile.ts's own early branch that routes here instead
      // of the trainee/course path — see that file's own comment.
      metadata: { trainingOrganizationId: org.id, type: "platform_fee", amountKobo: org.platformFeeKobo },
    }),
  });
  if (!res.ok) {
    throw new Error(`Paystack transaction initialize failed: ${res.status} ${await res.text()}`);
  }
  const parsed = TransactionInitResponseSchema.safeParse(await res.json());
  if (!parsed.success || !parsed.data.status) {
    throw new Error("Paystack transaction initialize returned an unexpected response.");
  }

  return {
    authorizationUrl: parsed.data.data.authorization_url,
    accessCode: parsed.data.data.access_code,
    reference: parsed.data.data.reference,
  };
}
