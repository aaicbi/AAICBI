import { describe, it, expect } from "vitest";
import { isFreeEmailProvider } from "../src/lib/employerVerification";

describe("isFreeEmailProvider", () => {
  it("flags a well-known free consumer email provider", () => {
    expect(isFreeEmailProvider("ada@gmail.com")).toBe(true);
    expect(isFreeEmailProvider("ada@yahoo.com")).toBe(true);
    expect(isFreeEmailProvider("ada@outlook.com")).toBe(true);
  });

  it("does not flag a genuine company domain", () => {
    expect(isFreeEmailProvider("ada@acme.com")).toBe(false);
    expect(isFreeEmailProvider("ada@aaicbi.org")).toBe(false);
  });

  it("is case-insensitive on the domain", () => {
    expect(isFreeEmailProvider("ada@GMAIL.COM")).toBe(true);
  });

  it("does not false-positive on a domain that merely contains a free provider's name", () => {
    // e.g. a real company called "gmail-consulting.com" is NOT gmail.com
    expect(isFreeEmailProvider("ada@gmail-consulting.com")).toBe(false);
    expect(isFreeEmailProvider("ada@notgmail.com")).toBe(false);
  });

  it("returns false rather than throwing on a malformed email", () => {
    expect(isFreeEmailProvider("not-an-email")).toBe(false);
    expect(isFreeEmailProvider("")).toBe(false);
  });
});
