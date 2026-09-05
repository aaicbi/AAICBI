import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyPaystackSignature } from "../src/lib/paystack/verifySignature";

const SECRET = "sk_test_fake_secret_for_testing_only";

function realSignatureFor(body: string): string {
  return createHmac("sha512", SECRET).update(body).digest("hex");
}

describe("verifyPaystackSignature", () => {
  it("accepts a genuinely correctly-signed body", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "TXN-001" } });
    expect(verifyPaystackSignature(body, realSignatureFor(body), SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret key", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "TXN-001" } });
    const wrongSignature = createHmac("sha512", "wrong_secret").update(body).digest("hex");
    expect(verifyPaystackSignature(body, wrongSignature, SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with after signing — proves the signature genuinely covers content, not just presence", () => {
    const originalBody = JSON.stringify({ event: "charge.success", data: { amount: 100000 } });
    const signature = realSignatureFor(originalBody);
    const tamperedBody = JSON.stringify({ event: "charge.success", data: { amount: 999999999 } });
    expect(verifyPaystackSignature(tamperedBody, signature, SECRET)).toBe(false);
  });

  it("rejects a missing signature header rather than throwing", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(verifyPaystackSignature(body, null, SECRET)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing — the exact case the length check exists to catch before timingSafeEqual would throw", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(() => verifyPaystackSignature(body, "too-short", SECRET)).not.toThrow();
    expect(verifyPaystackSignature(body, "too-short", SECRET)).toBe(false);
  });

  it("rejects an empty string signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(verifyPaystackSignature(body, "", SECRET)).toBe(false);
  });
});
