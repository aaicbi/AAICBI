/**
 * Direct platform-fee billing — the single source of truth for "does
 * this organization's direct-payment access currently cover them."
 * Deliberately pure and synchronous, no database, no network — same
 * testable discipline as hasCourseAccess's own core logic and
 * billingPeriod.ts's computePeriodEnd/computeFixedAccessEnd.
 *
 * REVENUE_SHARE organizations are always "active" here — this function
 * only ever gates the DIRECT_PAYMENT path; a revenue-share organization
 * has nothing to lapse in the first place.
 *
 * Trainee seat cap + SUPER_ADMIN waiver — `accessBlockWaived` is a
 * single flag covering BOTH reasons a DIRECT_PAYMENT organization could
 * otherwise be blocked: an unpaid/lapsed fee (checked here) and a full
 * seat cap (checked separately, see hasAvailableTrainingSeat in
 * trainingOrgSeatCap.ts). Folding the payment-lapse half in HERE, at
 * the one function requireRole/admin-layout.tsx/hasCourseAccess all
 * already call, is what makes a waived organization correctly un-gated
 * everywhere at once with no changes needed in any of those three
 * places.
 */
export function hasActivePlatformFeeAccess(org: {
  billingModel: "REVENUE_SHARE" | "DIRECT_PAYMENT";
  platformFeeCurrentPeriodEnd: Date | null;
  platformFeeAccessRevokedAt: Date | null;
  accessBlockWaived: boolean;
}): boolean {
  if (org.billingModel === "REVENUE_SHARE") return true;
  if (org.accessBlockWaived) return true;
  return (
    org.platformFeeAccessRevokedAt === null &&
    !!org.platformFeeCurrentPeriodEnd &&
    org.platformFeeCurrentPeriodEnd.getTime() > Date.now()
  );
}
