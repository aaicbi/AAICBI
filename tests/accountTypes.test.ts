import { describe, it, expect } from "vitest";
import { ACCOUNT_TYPES, accountType } from "@/lib/accounts/accountTypes";

describe("the five account types shown on /join", () => {
  it("are exactly trainee, organization, employer, investor and startup", () => {
    expect(ACCOUNT_TYPES.map((a) => a.key)).toEqual(["trainee", "organization", "employer", "investor", "startup"]);
  });
  it("each explain what it is for, what it can do, what it asks for and what it cannot do", () => {
    for (const a of ACCOUNT_TYPES) {
      expect(a.audience.length, a.key).toBeGreaterThan(10);
      expect(a.can.length, a.key).toBeGreaterThanOrEqual(4);
      expect(a.needs.length, a.key).toBeGreaterThanOrEqual(2);
      expect(a.limits.length, a.key).toBeGreaterThanOrEqual(1);
      expect(a.cta, a.key).toMatch(/^Create an? .+ account$/);
    }
  });
  it("each lead to their own registration page, and never to anything staff-only", () => {
    expect(ACCOUNT_TYPES.map((a) => a.href)).toEqual(["/trainee/register", "/org/register", "/employer/register", "/investor/register", "/startup/register"]);
    for (const a of ACCOUNT_TYPES) expect(`${a.key} ${a.href} ${a.cta}`, a.key).not.toMatch(/admin|staff|super|moderator|instructor/i);
  });
  it("say plainly where approval is needed, and that investing is not guaranteed", () => {
    for (const k of ["organization", "employer", "investor"] as const) expect(accountType(k).limits.join(" "), k).toMatch(/reviewed by the AAICBI team/);
    expect(accountType("investor").limits.join(" ")).toMatch(/does not guarantee funding/);
    expect(accountType("startup").limits.join(" ")).toMatch(/approves it/);
  });
});

import { readFileSync } from "node:fs";
describe("the founder sign-up on the server", () => {
  const src = readFileSync("src/app/api/auth/startup-register/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  it("requires consent, is rate limited, and sets the account kind itself", () => {
    expect(src).toMatch(/privacyConsent: z\.literal\(true/);
    expect(src).toMatch(/rateLimit\(/);
    expect(src).toMatch(/kind: "FOUNDER"/);
  });
  it("does not read a role or account kind from the request", () => {
    expect(src).not.toMatch(/d\.(role|kind|signupKind)|parsed\.data\.(role|kind|signupKind)/);
    expect(src).not.toMatch(/prisma\.user\./);
  });
});
