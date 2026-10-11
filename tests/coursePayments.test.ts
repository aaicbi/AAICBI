import { describe, expect, it } from "vitest";
import { describeRouting, isPaymentsTo, splitApplies } from "@/lib/courses/payments";

const share = { billingModel: "REVENUE_SHARE" as const, paystackSubaccountCode: "ACCT_x" };

describe("where new payments for a course go", () => {
  it("splits off the organization's share when it is on revenue share with a payout account and the course follows its owner", () => {
    expect(splitApplies({ paymentsTo: "OWNER" }, share)).toBe(true);
    expect(splitApplies({}, share)).toBe(true);
  });
  it("never splits when a super admin chose AAICBI keeps it all", () => {
    expect(splitApplies({ paymentsTo: "PLATFORM" }, share)).toBe(false);
  });
  it("does not split without an organization, a payout account, or on a platform-fee plan", () => {
    expect(splitApplies({ paymentsTo: "OWNER" }, null)).toBe(false);
    expect(splitApplies({ paymentsTo: "OWNER" }, { ...share, paystackSubaccountCode: null })).toBe(false);
    expect(splitApplies({ paymentsTo: "OWNER" }, { billingModel: "DIRECT_PAYMENT", paystackSubaccountCode: "ACCT_x" })).toBe(false);
  });
  it("explains each case in words", () => {
    const org = { ...share, name: "Northwind" };
    expect(describeRouting({}, null)).toMatch(/AAICBI/);
    expect(describeRouting({ paymentsTo: "PLATFORM" }, org)).toMatch(/keeps the whole payment/);
    expect(describeRouting({}, org)).toMatch(/split off/);
    expect(describeRouting({}, { ...org, paystackSubaccountCode: null })).toMatch(/no payout account/);
    expect(describeRouting({}, { ...org, billingModel: "DIRECT_PAYMENT" })).toMatch(/platform fee/);
  });
  it("accepts only the two choices", () => {
    expect(isPaymentsTo("OWNER") && isPaymentsTo("PLATFORM")).toBe(true);
    expect(isPaymentsTo("ORG")).toBe(false);
    expect(isPaymentsTo(undefined)).toBe(false);
  });
});
