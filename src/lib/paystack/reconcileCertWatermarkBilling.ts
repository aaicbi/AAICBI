/**
 * Certificate watermark removal — the "grant access from a confirmed
 * charge" logic for this product, mirroring
 * reconcileOrgBilling.ts's processConfirmedPlatformFeeCharge exactly
 * for a structurally identical but fully independent subject. Unlike
 * that function, there's no billingModel check here — this product has
 * nothing to do with billingModel at all (a REVENUE_SHARE org can hold
 * this subscription exactly the same way a DIRECT_PAYMENT org can).
 *
 * Takes an already-VERIFIED Paystack result, not a bare reference — same
 * reasoning as processConfirmedPlatformFeeCharge: this is called from
 * inside processConfirmedCharge right after ITS verify call.
 */
import { prisma } from "@/lib/prisma";
import { isGenuinePaymentSuccess, PaystackVerifyResult } from "@/lib/paystack/client";
import { computePeriodEnd } from "@/lib/paystack/billingPeriod";
import { notifyByEmail } from "@/lib/notifications/log";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { certWatermarkReceiptEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

export type ProcessCertWatermarkChargeResult =
  | { status: "granted"; trainingOrganizationId: string }
  | { status: "invalid_organization"; trainingOrganizationId: string }
  | { status: "not_genuine"; detail: string; trainingOrganizationId: string };

export async function processConfirmedCertWatermarkCharge(
  verified: PaystackVerifyResult,
  trainingOrganizationId: string,
  expectedAmountKobo: number
): Promise<ProcessCertWatermarkChargeResult> {
  const org = await prisma.trainingOrganization.findUnique({
    where: { id: trainingOrganizationId },
    select: { id: true, name: true, contactName: true, email: true, certWatermarkBillingInterval: true },
  });
  if (!org || !org.certWatermarkBillingInterval) {
    console.error(`charge.success (cert watermark) reference ${verified.data.reference} references organization ${trainingOrganizationId}, which is missing or has no watermark-removal interval set.`);
    return { status: "invalid_organization", trainingOrganizationId };
  }

  if (!isGenuinePaymentSuccess(verified, expectedAmountKobo)) {
    const detail = `expected ${expectedAmountKobo} kobo, got status=${verified.data.status} amount=${verified.data.amount}`;
    console.error(`charge.success (cert watermark) reference ${verified.data.reference} failed the genuine-success check — ${detail}. No access granted.`);
    return { status: "not_genuine", detail, trainingOrganizationId };
  }

  const now = new Date();
  const currentPeriodEnd = computePeriodEnd(now, org.certWatermarkBillingInterval);
  const customerCode = verified.data.customer?.customer_code ?? null;

  await prisma.trainingOrganization.update({
    where: { id: org.id },
    data: {
      certWatermarkCurrentPeriodEnd: currentPeriodEnd,
      certWatermarkAccessRevokedAt: null,
      certWatermarkPaystackCustomerCode: customerCode,
    },
  });

  const content = certWatermarkReceiptEmail({
    contactName: org.contactName,
    amountKobo: expectedAmountKobo,
    reference: verified.data.reference,
    paidAt: now.toLocaleDateString(),
    nextBillingDate: currentPeriodEnd.toLocaleDateString(),
    dashboardUrl: appUrl("/org/billing"),
  });
  await notifyByEmail({
    recipientType: "TRAINING_ORG",
    recipientId: org.id,
    to: org.email,
    type: "CERT_WATERMARK_FEE_PAID",
    url: "/org/billing",
    subject: content.subject,
    html: content.html,
    text: content.text,
  }).catch((e) => console.error(`Failed to send watermark-removal receipt for organization ${org.id}:`, e));

  const adminContent = {
    subject: `Certificate Watermark Removal Fee Received: ${org.name}`,
    html: `<p>Training organization <strong>${org.name}</strong> paid ₦${(expectedAmountKobo / 100).toLocaleString()} to remove the certificate watermark (Ref: ${verified.data.reference}).</p>`,
    text: `Training organization ${org.name} paid ₦${(expectedAmountKobo / 100).toLocaleString()} to remove the certificate watermark (Ref: ${verified.data.reference}).`,
  };
  await notifyAllAdminStaff("CERT_WATERMARK_FEE_PAID", org.id, adminContent, "/admin/training-organizations").catch(
    (e) => console.error(`Failed to send admin watermark-removal notification for organization ${org.id}:`, e)
  );

  console.log(`Certificate watermark removal granted: organization ${org.id}, reference ${verified.data.reference}.`);
  return { status: "granted", trainingOrganizationId: org.id };
}
