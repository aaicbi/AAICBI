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
 */
export function hasActivePlatformFeeAccess(org: {
  billingModel: "REVENUE_SHARE" | "DIRECT_PAYMENT";
  platformFeeCurrentPeriodEnd: Date | null;
  platformFeeAccessRevokedAt: Date | null;
}): boolean {
  if (org.billingModel === "REVENUE_SHARE") return true;
  return (
    org.platformFeeAccessRevokedAt === null &&
    !!org.platformFeeCurrentPeriodEnd &&
    org.platformFeeCurrentPeriodEnd.getTime() > Date.now()
  );
}
