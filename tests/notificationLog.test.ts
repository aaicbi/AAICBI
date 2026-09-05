import { describe, it, expect } from "vitest";
import { redactEmails, redactPhoneNumbers } from "@/lib/notifications/redact";

describe("redactEmails", () => {
  it("redacts a plain email address", () => {
    expect(redactEmails("Invalid recipient: someone@example.com")).toBe("Invalid recipient: [redacted]");
  });

  it("redacts multiple email addresses in the same string", () => {
    const result = redactEmails("Could not deliver to a@x.com or b@y.com");
    expect(result).not.toContain("a@x.com");
    expect(result).not.toContain("b@y.com");
    expect(result).toBe("Could not deliver to [redacted] or [redacted]");
  });

  it("leaves a string with no email address unchanged", () => {
    expect(redactEmails("Domain not verified")).toBe("Domain not verified");
  });

  it("redacts an address with a subdomain and plus-addressing", () => {
    expect(redactEmails("bad address: user+tag@mail.example.co.uk")).toBe("bad address: [redacted]");
  });
});

/**
 * M43 — the same real risk as redactEmails above, applied to the
 * second channel this project now has.
 */
describe("redactPhoneNumbers", () => {
  it("redacts an E.164-formatted phone number", () => {
    expect(redactPhoneNumbers("Invalid recipient: +2348012345678")).toBe("Invalid recipient: [redacted]");
  });

  it("redacts a phone number with no leading plus", () => {
    expect(redactPhoneNumbers("Could not deliver to 2348012345678")).toBe("Could not deliver to [redacted]");
  });

  it("leaves a string with no phone-shaped number unchanged", () => {
    expect(redactPhoneNumbers("Template not approved")).toBe("Template not approved");
  });

  it("does not redact a short number that isn't phone-shaped (e.g. an HTTP status code)", () => {
    expect(redactPhoneNumbers("Request failed with status 404")).toBe("Request failed with status 404");
  });
});
