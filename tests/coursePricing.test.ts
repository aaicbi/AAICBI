import { describe, it, expect } from "vitest";
import { validateCoursePricing } from "../src/lib/coursePricing";

describe("validateCoursePricing", () => {
  it("accepts a free course with no price and no billing interval", () => {
    expect(validateCoursePricing(true, null, null)).toBeNull();
    expect(validateCoursePricing(true, undefined, undefined)).toBeNull();
  });

  it("rejects a free course that somehow has a price set", () => {
    expect(validateCoursePricing(true, 5000, null)).not.toBeNull();
  });

  it("rejects a free course that somehow has a billing interval set — M26 extension of the same gap", () => {
    expect(validateCoursePricing(true, null, "MONTHLY")).not.toBeNull();
  });

  it("accepts a paid course with a positive price and a billing interval", () => {
    expect(validateCoursePricing(false, 500000, "MONTHLY")).toBeNull();
  });

  it("rejects a paid course with no price at all — the exact gap this was built to close", () => {
    expect(validateCoursePricing(false, null, "MONTHLY")).not.toBeNull();
    expect(validateCoursePricing(false, undefined, "MONTHLY")).not.toBeNull();
  });

  it("rejects a paid course with a zero or negative price", () => {
    expect(validateCoursePricing(false, 0, "MONTHLY")).not.toBeNull();
    expect(validateCoursePricing(false, -100, "MONTHLY")).not.toBeNull();
  });

  it("rejects a paid course with no billing interval — the M26 extension of the exact same gap", () => {
    expect(validateCoursePricing(false, 500000, null)).not.toBeNull();
    expect(validateCoursePricing(false, 500000, undefined)).not.toBeNull();
  });
});
