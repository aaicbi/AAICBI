import { describe, it, expect } from "vitest";
import { isEligibleForWhatsApp } from "../src/lib/notifications/whatsappEligibility";

describe("isEligibleForWhatsApp", () => {
  it("accepts a trainee who opted in, has a verified number, and a phone on file", () => {
    expect(
      isEligibleForWhatsApp({ whatsappOptIn: true, whatsappVerifiedAt: new Date(), phone: "+2348012345678" })
    ).toBe(true);
  });

  it("rejects a trainee who never opted in, even with a verified number", () => {
    expect(
      isEligibleForWhatsApp({ whatsappOptIn: false, whatsappVerifiedAt: new Date(), phone: "+2348012345678" })
    ).toBe(false);
  });

  it("rejects a trainee who opted in but never verified their number", () => {
    expect(isEligibleForWhatsApp({ whatsappOptIn: true, whatsappVerifiedAt: null, phone: "+2348012345678" })).toBe(
      false
    );
  });

  it("rejects a trainee with no phone number at all, even if the other flags are somehow set", () => {
    expect(isEligibleForWhatsApp({ whatsappOptIn: true, whatsappVerifiedAt: new Date(), phone: null })).toBe(false);
  });

  it("rejects the genuinely default state — nothing set", () => {
    expect(isEligibleForWhatsApp({ whatsappOptIn: false, whatsappVerifiedAt: null, phone: null })).toBe(false);
  });
});
