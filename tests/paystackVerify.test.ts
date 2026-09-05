import { describe, it, expect } from "vitest";
import { isGenuinePaymentSuccess, type PaystackVerifyResult } from "../src/lib/paystack/client";

function makeResult(overrides: Partial<PaystackVerifyResult["data"]> = {}, apiStatus = true): PaystackVerifyResult {
  return {
    status: apiStatus,
    message: "test",
    data: {
      status: "success",
      reference: "TXN-001",
      amount: 500000,
      currency: "NGN",
      gateway_response: "Successful",
      paid_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    },
  };
}

describe("isGenuinePaymentSuccess", () => {
  it("accepts a genuinely successful transaction for the expected amount", () => {
    expect(isGenuinePaymentSuccess(makeResult(), 500000)).toBe(true);
  });

  it("rejects a failed transaction even if the API call itself succeeded", () => {
    expect(isGenuinePaymentSuccess(makeResult({ status: "failed" }), 500000)).toBe(false);
  });

  it("rejects an abandoned transaction", () => {
    expect(isGenuinePaymentSuccess(makeResult({ status: "abandoned" }), 500000)).toBe(false);
  });

  it("rejects a successful transaction for the WRONG amount — the specific attack this check exists to catch", () => {
    expect(isGenuinePaymentSuccess(makeResult({ amount: 100 }), 500000)).toBe(false);
  });

  it("rejects when the API call itself failed, regardless of what data.status claims", () => {
    expect(isGenuinePaymentSuccess(makeResult({ status: "success" }, false), 500000)).toBe(false);
  });

  it("rejects a matching numeric amount in the WRONG currency — the exact real-world exploit a dedicated Paystack integration guide describes: the same number means a wildly different real value in NGN kobo versus USD cents", () => {
    expect(isGenuinePaymentSuccess(makeResult({ currency: "USD" }), 500000)).toBe(false);
  });
});
