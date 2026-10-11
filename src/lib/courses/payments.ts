/**
 * Where new payments for a course go. Payments always arrive in AAICBI's Paystack account; for a course owned by a training
 * organization on revenue share, Paystack can split the organization's portion off to its subaccount.
 *
 * A super admin decides, per course, whether that split applies:
 *   OWNER     follow the owner's billing setup (the default)
 *   PLATFORM  AAICBI keeps the whole payment, whoever owns the course
 * Moving a paid course to an organization asks for this decision, so a payment arrangement never changes by accident.
 * Subscriptions already running are not changed either way.
 */
export type PaymentsTo = "OWNER" | "PLATFORM";
export const isPaymentsTo = (v: unknown): v is PaymentsTo => v === "OWNER" || v === "PLATFORM";

export interface OrgBilling {
  billingModel: "REVENUE_SHARE" | "DIRECT_PAYMENT";
  paystackSubaccountCode: string | null;
}

/** Does Paystack split off a share for the owning organization on this course's new payments? */
export function splitApplies(course: { paymentsTo?: string | null }, org: OrgBilling | null): boolean {
  if (course.paymentsTo === "PLATFORM") return false;
  return !!org && org.billingModel === "REVENUE_SHARE" && !!org.paystackSubaccountCode;
}

/** The sentence a super admin reads next to the choice. */
export function describeRouting(course: { paymentsTo?: string | null }, org: (OrgBilling & { name: string }) | null): string {
  if (!org) return "New payments go to AAICBI.";
  if (course.paymentsTo === "PLATFORM") return `AAICBI keeps the whole payment, even though ${org.name} owns the course.`;
  if (org.billingModel === "DIRECT_PAYMENT") return `${org.name} pays AAICBI a platform fee instead of sharing revenue, so there is no split: payments go to AAICBI.`;
  if (!org.paystackSubaccountCode) return `${org.name} shares revenue but has no payout account set up yet, so payments go to AAICBI until you add one in Training Organizations.`;
  return `${org.name}'s share is split off to its payout account on every new payment.`;
}
