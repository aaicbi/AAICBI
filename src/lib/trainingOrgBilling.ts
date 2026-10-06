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

/**
 * Certificate watermark removal — a second, fully independent monthly
 * subscription (see TrainingOrganization's own schema comment on the
 * certWatermark* field group) with no relationship to billingModel at
 * all: a REVENUE_SHARE org can hold this subscription exactly the same
 * way a DIRECT_PAYMENT org can. Same pure/sync shape as
 * hasActivePlatformFeeAccess, deliberately split into two functions
 * (this one checks the live subscription; shouldShowCertWatermark below
 * folds in the manual override) rather than one combined function, so
 * each stays independently testable.
 */
export function hasActiveCertWatermarkRemoval(org: {
  certWatermarkCurrentPeriodEnd: Date | null;
  certWatermarkAccessRevokedAt: Date | null;
}): boolean {
  return (
    org.certWatermarkAccessRevokedAt === null &&
    !!org.certWatermarkCurrentPeriodEnd &&
    org.certWatermarkCurrentPeriodEnd.getTime() > Date.now()
  );
}

/**
 * The actual question every certificate-rendering call site asks:
 * should THIS org's certificates carry the "Powered by AAICBI" mark
 * right now. brandingFooterRemoved is a manual SUPER_ADMIN override/
 * waiver — same role accessBlockWaived plays for platform-fee access —
 * checked first so a manually-arranged deal always wins regardless of
 * subscription state.
 */
export function shouldShowCertWatermark(org: {
  brandingFooterRemoved: boolean;
  certWatermarkCurrentPeriodEnd: Date | null;
  certWatermarkAccessRevokedAt: Date | null;
}): boolean {
  if (org.brandingFooterRemoved) return false;
  return !hasActiveCertWatermarkRemoval(org);
}
