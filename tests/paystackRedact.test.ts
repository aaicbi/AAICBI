import { describe, it, expect } from "vitest";
import { redactPaystackPayloadForStorage } from "../src/lib/paystack/redact";

describe("redactPaystackPayloadForStorage", () => {
  it("strips the authorization object, including the reusable charge token", () => {
    const event = {
      event: "charge.success",
      data: {
        reference: "TXN-001",
        amount: 500000,
        authorization: {
          authorization_code: "AUTH_realtoken123",
          bin: "408408",
          last4: "4081",
          signature: "SIG_realsignature",
        },
      },
    };
    const redacted = redactPaystackPayloadForStorage(event) as any;
    expect(redacted.data.authorization).toEqual({ redacted: true });
    expect(JSON.stringify(redacted)).not.toContain("AUTH_realtoken123");
  });

  it("strips real customer PII from a bank-transfer authorization object", () => {
    const event = {
      event: "charge.success",
      data: {
        reference: "TXN-002",
        authorization: {
          sender_name: "RANDALL AKANBI HORTON",
          sender_bank_account_number: "0123456789",
        },
      },
    };
    const redacted = redactPaystackPayloadForStorage(event) as any;
    expect(JSON.stringify(redacted)).not.toContain("RANDALL AKANBI HORTON");
    expect(JSON.stringify(redacted)).not.toContain("0123456789");
  });

  it("preserves genuinely useful, non-sensitive fields for debugging", () => {
    const event = {
      event: "charge.success",
      data: {
        reference: "TXN-003",
        amount: 500000,
        status: "success",
        authorization: { authorization_code: "AUTH_x" },
      },
    };
    const redacted = redactPaystackPayloadForStorage(event) as any;
    expect(redacted.event).toBe("charge.success");
    expect(redacted.data.reference).toBe("TXN-003");
    expect(redacted.data.amount).toBe(500000);
    expect(redacted.data.status).toBe("success");
  });

  it("does not mutate the original event object", () => {
    const event = { event: "charge.success", data: { authorization: { authorization_code: "AUTH_x" } } };
    redactPaystackPayloadForStorage(event);
    expect(event.data.authorization.authorization_code).toBe("AUTH_x");
  });

  it("handles an event with no authorization object at all without throwing", () => {
    const event = { event: "subscription.disable", data: { subscription_code: "SUB_x" } };
    expect(() => redactPaystackPayloadForStorage(event)).not.toThrow();
    const redacted = redactPaystackPayloadForStorage(event) as any;
    expect(redacted.data.subscription_code).toBe("SUB_x");
  });
});
