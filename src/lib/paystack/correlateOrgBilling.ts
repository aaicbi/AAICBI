/**
 * Direct platform-fee billing — the organization-side counterpart to
 * correlate.ts's findEnrollmentForSubscriptionEvent, same two-strategy
 * shape and the exact same strictCodeMatch reasoning (see that file's
 * own doc comment for the full explanation): a subscription_code that's
 * PRESENT but matches nothing is a strong staleness signal for the
 * revoke-consequential events (subscription.disable/not_renew) and
 * should not fall back to the weaker customer+plan match, but is
 * expected and fine to fall through for subscription.create itself.
 */
import { prisma } from "@/lib/prisma";

export async function findTrainingOrgForSubscriptionEvent(
  data: Record<string, unknown>,
  strictCodeMatch: boolean
): Promise<{ id: string } | null> {
  const subscriptionCode = typeof data.subscription_code === "string" ? data.subscription_code : null;
  if (subscriptionCode) {
    const byCode = await prisma.trainingOrganization.findUnique({
      where: { platformFeePaystackSubscriptionCode: subscriptionCode },
      select: { id: true },
    });
    if (byCode) return byCode;
    if (strictCodeMatch) return null;
  }

  const customerCode =
    typeof data.customer === "object" && data.customer !== null && "customer_code" in data.customer
      ? (data.customer as { customer_code: unknown }).customer_code
      : null;
  const planCode =
    typeof data.plan === "object" && data.plan !== null && "plan_code" in data.plan
      ? (data.plan as { plan_code: unknown }).plan_code
      : null;
  if (typeof customerCode !== "string" || typeof planCode !== "string") return null;

  return prisma.trainingOrganization.findFirst({
    where: { platformFeePaystackPlanCode: planCode, platformFeePaystackCustomerCode: customerCode },
    select: { id: true },
  });
}

/**
 * Certificate watermark removal — the same two-strategy correlation as
 * findTrainingOrgForSubscriptionEvent above, against the certWatermark*
 * fields instead. Kept as its own function rather than a parameterized
 * version of the one above: a webhook event for one product's
 * subscription_code must never accidentally match the other product's
 * row, and two small explicit functions make that impossible by
 * construction rather than by a shared parameter that could be passed
 * wrong.
 */
export async function findTrainingOrgForCertWatermarkSubscriptionEvent(
  data: Record<string, unknown>,
  strictCodeMatch: boolean
): Promise<{ id: string } | null> {
  const subscriptionCode = typeof data.subscription_code === "string" ? data.subscription_code : null;
  if (subscriptionCode) {
    const byCode = await prisma.trainingOrganization.findUnique({
      where: { certWatermarkPaystackSubscriptionCode: subscriptionCode },
      select: { id: true },
    });
    if (byCode) return byCode;
    if (strictCodeMatch) return null;
  }

  const customerCode =
    typeof data.customer === "object" && data.customer !== null && "customer_code" in data.customer
      ? (data.customer as { customer_code: unknown }).customer_code
      : null;
  const planCode =
    typeof data.plan === "object" && data.plan !== null && "plan_code" in data.plan
      ? (data.plan as { plan_code: unknown }).plan_code
      : null;
  if (typeof customerCode !== "string" || typeof planCode !== "string") return null;

  return prisma.trainingOrganization.findFirst({
    where: { certWatermarkPaystackPlanCode: planCode, certWatermarkPaystackCustomerCode: customerCode },
    select: { id: true },
  });
}
