import { describe, it, expect } from "vitest";
import { generateOtpCode } from "../src/lib/paystack/otp";

describe("generateOtpCode", () => {
  it("always returns exactly 6 characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOtpCode()).toHaveLength(6);
    }
  });

  it("always returns only digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it("actually produces zero-padded codes for small values — run enough times that this is a near-certainty, not just a possibility", () => {
    // randomInt(0, 1_000_000) can genuinely return a value like 42,
    // which needs to render as "000042", not "42" — a real edge case
    // worth explicitly proving pads correctly, not just trusting
    // padStart works in general.
    const codes = Array.from({ length: 5000 }, () => generateOtpCode());
    const hasLeadingZero = codes.some((c) => c.startsWith("0"));
    expect(hasLeadingZero).toBe(true);
  });
});
