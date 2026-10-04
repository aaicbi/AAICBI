/**
 * Direct platform-fee billing — the "grant access from a confirmed
 * charge" logic for a TrainingOrganization's own platform-fee payment,
 * mirroring processConfirmedCharge's (reconcile.ts) charge.success
 * handling faithfully rather than generalizing the two into one
 * function — the subject being billed is structurally different (an
 * organization, not a trainee+course pair), and reconcile.ts's own
 * trainee logic has already been through several real audit passes
 * that reproducing it exactly, for a different subject, shouldn't risk
 * disturbing.
 *
 * Takes an already-VERIFIED Paystack result, not a bare reference —
 * unlike processConfirmedCharge, which does its own verify call. This
 * is called from inside processConfirmedCharge right after ITS verify
 * call (see that function's own early-branch comment), so verifying
 * twice for the same reference would be pure waste.
 */
import { prisma } from "@/lib/prisma";
import { isGenuinePaymentSuccess, PaystackVerifyResult } from "@/lib/paystack/client";
import { computePeriodEnd } from "@/lib/paystack/billingPeriod";
import { notifyByEmail } from "@/lib/notifications/log";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { platformFeeReceiptEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

export type ProcessPlatformFeeChargeResult =
  | { status: "granted"; trainingOrganizationId: string }
  | { status: "invalid_organization"; trainingOrganizationId: string }
  | { status: "not_genuine"; detail: string; trainingOrganizationId: string };

export async function processConfirmedPlatformFeeCharge(
  verified: PaystackVerifyResult,
  trainingOrganizationId: string,
  expectedAmountKobo: number
): Promise<ProcessPlatformFeeChargeResult> {
  const org = await prisma.trainingOrganization.findUnique({
    where: { id: trainingOrganizationId },
    select: { id: true, name: true, contactName: true, email: true, billingModel: true, platformFeeBillingInterval: true },
  });
  if (!org || org.billingModel !== "DIRECT_PAYMENT" || !org.platformFeeBillingInterval) {
    console.error(`charge.success (platform fee) reference ${verified.data.reference} references organization ${trainingOrganizationId}, which is missing or not on direct-payment billing.`);
    return { status: "invalid_organization", trainingOrganizationId };
  }

  if (!isGenuinePaymentSuccess(verified, expectedAmountKobo)) {
    const detail = `expected ${expectedAmountKobo} kobo, got status=${verified.data.status} amount=${verified.data.amount}`;
    console.error(`charge.success (platform fee) reference ${verified.data.reference} failed the genuine-success check — ${detail}. No access granted.`);
    return { status: "not_genuine", detail, trainingOrganizationId };
  }

  const now = new Date();
  const currentPeriodEnd = computePeriodEnd(now, org.platformFeeBillingInterval);
  const customerCode = verified.data.customer?.customer_code ?? null;

  await prisma.trainingOrganization.update({
    where: { id: org.id },
    data: {
      platformFeeCurrentPeriodEnd: currentPeriodEnd,
      platformFeeAccessRevokedAt: null,
      platformFeePaystackCustomerCode: customerCode,
    },
  });

  const content = platformFeeReceiptEmail({
    contactName: org.contactName,
    amountKobo: expectedAmountKobo,
    reference: verified.data.reference,
    paidAt: now.toLocaleDateString(),
    nextBillingDate: currentPeriodEnd.toLocaleDateString(),
    dashboardUrl: appUrl("/admin/dashboard"),
  });
  await notifyByEmail({
    recipientType: "TRAINING_ORG",
    recipientId: org.id,
    to: org.email,
    type: "PLATFORM_FEE_PAID",
    url: "/admin/dashboard",
    subject: content.subject,
    html: content.html,
    text: content.text,
  }).catch((e) => console.error(`Failed to send platform-fee receipt for organization ${org.id}:`, e));

  const adminContent = {
    subject: `Platform Fee Received: ${org.name}`,
    html: `<p>Training organization <strong>${org.name}</strong> paid ₦${(expectedAmountKobo / 100).toLocaleString()} for their platform access (Ref: ${verified.data.reference}).</p>`,
    text: `Training organization ${org.name} paid ₦${(expectedAmountKobo / 100).toLocaleString()} for their platform access (Ref: ${verified.data.reference}).`,
  };
  await notifyAllAdminStaff("PLATFORM_FEE_PAID", org.id, adminContent, "/admin/training-organizations").catch(
    (e) => console.error(`Failed to send admin platform-fee notification for organization ${org.id}:`, e)
  );

  console.log(`Platform-fee access granted: organization ${org.id}, reference ${verified.data.reference}.`);
  return { status: "granted", trainingOrganizationId: org.id };
}
