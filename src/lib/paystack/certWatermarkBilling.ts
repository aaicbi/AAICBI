/**
 * Certificate watermark removal — a second, fully independent monthly
 * product alongside orgBilling.ts's platform-fee pipeline, mirrored
 * deliberately rather than generalized into one shared function (same
 * reasoning as orgBilling.ts's own top comment): this product has
 * nothing to do with billingModel, and keeping it as its own parallel
 * pipeline means a change to platform-fee billing can never silently
 * also change watermark-removal billing's behavior, or vice versa.
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
  certWatermarkFeeKobo: number | null;
  certWatermarkBillingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
  certWatermarkPaystackPlanCode: string | null;
};

/**
 * Get-or-create, same shape and same deliberately-accepted race as
 * getOrCreatePlatformFeePlan: two near-simultaneous first payment
 * attempts could both create a Plan, leaving one harmless orphan in the
 * Paystack dashboard — not worth real locking to prevent.
 */
export async function getOrCreateCertWatermarkPlan(org: BillableOrg): Promise<string> {
  if (org.certWatermarkPaystackPlanCode) return org.certWatermarkPaystackPlanCode;
  if (!org.certWatermarkFeeKobo || !org.certWatermarkBillingInterval) {
    throw new Error(`Training organization ${org.id} has no watermark-removal fee/interval set — cannot create a Paystack plan.`);
  }

  const res = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `AAICBI Certificate Watermark Removal — ${org.name}`,
      amount: org.certWatermarkFeeKobo,
      interval: INTERVAL_MAP[org.certWatermarkBillingInterval],
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
    data: { certWatermarkPaystackPlanCode: parsed.data.data.plan_code },
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

export async function initializeCertWatermarkPayment(
  org: BillableOrg
): Promise<{ authorizationUrl: string; accessCode?: string; reference: string }> {
  const appUrl = process.env.APP_URL ?? "https://aaicbi.org";
  const planCode = await getOrCreateCertWatermarkPlan(org);

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: org.email,
      amount: org.certWatermarkFeeKobo,
      currency: "NGN",
      plan: planCode,
      callback_url: `${appUrl}/org/billing/payment-callback`,
      // Read back by processConfirmedCertWatermarkCharge
      // (reconcileCertWatermarkBilling.ts) via reconcile.ts's own
      // type-discriminated branch — see that file's own comment on why
      // the `type` field is what keeps this from colliding with a
      // platform-fee charge, which carries the exact same
      // trainingOrganizationId metadata shape otherwise.
      metadata: { trainingOrganizationId: org.id, type: "cert_watermark_fee", amountKobo: org.certWatermarkFeeKobo },
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
