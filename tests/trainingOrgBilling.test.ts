import { describe, it, expect } from "vitest";
import { hasActivePlatformFeeAccess } from "../src/lib/trainingOrgBilling";

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
