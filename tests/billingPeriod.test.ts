import { describe, it, expect } from "vitest";
import { computePeriodEnd } from "../src/lib/paystack/billingPeriod";

describe("computePeriodEnd", () => {
  it("adds one month for MONTHLY", () => {
    const result = computePeriodEnd(new Date("2026-03-15T00:00:00.000Z"), "MONTHLY");
    expect(result.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("adds three months for QUARTERLY", () => {
    const result = computePeriodEnd(new Date("2026-01-01T00:00:00.000Z"), "QUARTERLY");
    expect(result.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("adds one year for ANNUALLY", () => {
    const result = computePeriodEnd(new Date("2026-03-15T00:00:00.000Z"), "ANNUALLY");
    expect(result.toISOString()).toBe("2027-03-15T00:00:00.000Z");
  });

  it("documents the real JS Date month-overflow behavior for a month-end start date, rather than leave it a silent surprise — Jan 31 + 1 month rolls into March, since February doesn't have 31 days", () => {
    const result = computePeriodEnd(new Date("2026-01-31T00:00:00.000Z"), "MONTHLY");
    // This IS the actual, correct JS Date behavior — documented here
    // deliberately so it's a known, tested fact about this function
    // rather than something discovered by surprise on a real trainee's
    // real billing date later.
    expect(result.toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });

  it("does not mutate the original date passed in", () => {
    const original = new Date("2026-03-15T00:00:00.000Z");
    const originalTime = original.getTime();
    computePeriodEnd(original, "MONTHLY");
    expect(original.getTime()).toBe(originalTime);
  });
});
