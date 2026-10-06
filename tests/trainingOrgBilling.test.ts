import { describe, it, expect } from "vitest";
import { hasActivePlatformFeeAccess, hasActiveCertWatermarkRemoval, shouldShowCertWatermark } from "../src/lib/trainingOrgBilling";

describe("hasActivePlatformFeeAccess", () => {
  it("is always active for a REVENUE_SHARE organization, regardless of the fee fields", () => {
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "REVENUE_SHARE",
        platformFeeCurrentPeriodEnd: null,
        platformFeeAccessRevokedAt: new Date(),
        accessBlockWaived: false,
      })
    ).toBe(true);
  });

  it("is inactive for DIRECT_PAYMENT with no period end set yet", () => {
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: null,
        platformFeeAccessRevokedAt: null,
        accessBlockWaived: false,
      })
    ).toBe(false);
  });

  it("is active for DIRECT_PAYMENT with a future period end and no revocation", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: future,
        platformFeeAccessRevokedAt: null,
        accessBlockWaived: false,
      })
    ).toBe(true);
  });

  it("is inactive for DIRECT_PAYMENT with a past period end", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: past,
        platformFeeAccessRevokedAt: null,
        accessBlockWaived: false,
      })
    ).toBe(false);
  });

  it("is inactive for DIRECT_PAYMENT when explicitly revoked, even with a future period end", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: future,
        platformFeeAccessRevokedAt: new Date(),
        accessBlockWaived: false,
      })
    ).toBe(false);
  });

  it("is active for DIRECT_PAYMENT with no period end at all, when waived", () => {
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: null,
        platformFeeAccessRevokedAt: null,
        accessBlockWaived: true,
      })
    ).toBe(true);
  });

  it("is active for DIRECT_PAYMENT with a past period end, when waived", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: past,
        platformFeeAccessRevokedAt: null,
        accessBlockWaived: true,
      })
    ).toBe(true);
  });

  it("is active for DIRECT_PAYMENT when explicitly revoked, when waived", () => {
    expect(
      hasActivePlatformFeeAccess({
        billingModel: "DIRECT_PAYMENT",
        platformFeeCurrentPeriodEnd: null,
        platformFeeAccessRevokedAt: new Date(),
        accessBlockWaived: true,
      })
    ).toBe(true);
  });
});

describe("hasActiveCertWatermarkRemoval", () => {
  it("is inactive with no period end set yet", () => {
    expect(hasActiveCertWatermarkRemoval({ certWatermarkCurrentPeriodEnd: null, certWatermarkAccessRevokedAt: null })).toBe(false);
  });

  it("is active with a future period end and no revocation", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(hasActiveCertWatermarkRemoval({ certWatermarkCurrentPeriodEnd: future, certWatermarkAccessRevokedAt: null })).toBe(true);
  });

  it("is inactive with a past period end", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    expect(hasActiveCertWatermarkRemoval({ certWatermarkCurrentPeriodEnd: past, certWatermarkAccessRevokedAt: null })).toBe(false);
  });

  it("is inactive when explicitly revoked, even with a future period end", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(hasActiveCertWatermarkRemoval({ certWatermarkCurrentPeriodEnd: future, certWatermarkAccessRevokedAt: new Date() })).toBe(false);
  });
});

describe("shouldShowCertWatermark", () => {
  it("shows the watermark with no subscription and no manual waiver", () => {
    expect(
      shouldShowCertWatermark({ brandingFooterRemoved: false, certWatermarkCurrentPeriodEnd: null, certWatermarkAccessRevokedAt: null })
    ).toBe(true);
  });

  it("hides the watermark with an active subscription", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(
      shouldShowCertWatermark({ brandingFooterRemoved: false, certWatermarkCurrentPeriodEnd: future, certWatermarkAccessRevokedAt: null })
    ).toBe(false);
  });

  it("shows the watermark again once the subscription lapses", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(
      shouldShowCertWatermark({ brandingFooterRemoved: false, certWatermarkCurrentPeriodEnd: future, certWatermarkAccessRevokedAt: new Date() })
    ).toBe(true);
  });

  it("hides the watermark via the manual override even with no subscription at all", () => {
    expect(
      shouldShowCertWatermark({ brandingFooterRemoved: true, certWatermarkCurrentPeriodEnd: null, certWatermarkAccessRevokedAt: null })
    ).toBe(false);
  });

  it("the manual override wins even over a lapsed subscription", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    expect(
      shouldShowCertWatermark({ brandingFooterRemoved: true, certWatermarkCurrentPeriodEnd: past, certWatermarkAccessRevokedAt: new Date() })
    ).toBe(false);
  });
});
