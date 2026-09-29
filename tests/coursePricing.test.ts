import { describe, it, expect } from "vitest";
import { validateCoursePricing, getEffectivePriceKobo } from "../src/lib/coursePricing";

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

  describe("accessModel (course enrollment/subscription system)", () => {
    it("defaults to RECURRING_SUBSCRIPTION when accessConfig is omitted — every pre-existing call site keeps working unchanged", () => {
      expect(validateCoursePricing(false, 500000, "MONTHLY")).toBeNull();
    });

    it("rejects a free course with an access duration or reminders set", () => {
      expect(validateCoursePricing(true, null, null, { accessDurationUnit: "LIFETIME" })).not.toBeNull();
      expect(validateCoursePricing(true, null, null, { accessDurationUnit: "DAYS", accessDurationValue: 30 })).not.toBeNull();
      expect(validateCoursePricing(true, null, null, { reminderEnabled: true })).not.toBeNull();
    });

    it("rejects a RECURRING_SUBSCRIPTION course that also sets a fixed access duration", () => {
      expect(
        validateCoursePricing(false, 500000, "MONTHLY", { accessModel: "RECURRING_SUBSCRIPTION", accessDurationUnit: "DAYS", accessDurationValue: 30 })
      ).not.toBeNull();
    });

    it("rejects a RECURRING_SUBSCRIPTION course with reminders enabled", () => {
      expect(validateCoursePricing(false, 500000, "MONTHLY", { accessModel: "RECURRING_SUBSCRIPTION", reminderEnabled: true })).not.toBeNull();
    });

    it("accepts a FIXED_DURATION course with a positive value and DAYS/MONTHS unit", () => {
      expect(validateCoursePricing(false, 5000000, null, { accessModel: "FIXED_DURATION", accessDurationValue: 90, accessDurationUnit: "DAYS" })).toBeNull();
      expect(validateCoursePricing(false, 10000000, null, { accessModel: "FIXED_DURATION", accessDurationValue: 12, accessDurationUnit: "MONTHS" })).toBeNull();
    });

    it("accepts a FIXED_DURATION course with LIFETIME and no numeric value", () => {
      expect(validateCoursePricing(false, 5000000, null, { accessModel: "FIXED_DURATION", accessDurationUnit: "LIFETIME" })).toBeNull();
    });

    it("rejects a FIXED_DURATION course with LIFETIME that also sets a numeric value", () => {
      expect(
        validateCoursePricing(false, 5000000, null, { accessModel: "FIXED_DURATION", accessDurationUnit: "LIFETIME", accessDurationValue: 30 })
      ).not.toBeNull();
    });

    it("rejects a FIXED_DURATION course missing accessDurationUnit", () => {
      expect(validateCoursePricing(false, 5000000, null, { accessModel: "FIXED_DURATION" })).not.toBeNull();
    });

    it("rejects a FIXED_DURATION course with a zero or missing value for a non-lifetime unit", () => {
      expect(validateCoursePricing(false, 5000000, null, { accessModel: "FIXED_DURATION", accessDurationUnit: "DAYS" })).not.toBeNull();
      expect(validateCoursePricing(false, 5000000, null, { accessModel: "FIXED_DURATION", accessDurationUnit: "DAYS", accessDurationValue: 0 })).not.toBeNull();
    });

    it("rejects a FIXED_DURATION course that also sets a billing interval", () => {
      expect(
        validateCoursePricing(false, 5000000, "MONTHLY", { accessModel: "FIXED_DURATION", accessDurationUnit: "LIFETIME" })
      ).not.toBeNull();
    });
  });

  describe("discountPercent (course discounts)", () => {
    it("accepts a paid course with a valid 1-99 discount", () => {
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, 20)).toBeNull();
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, 1)).toBeNull();
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, 99)).toBeNull();
    });

    it("accepts a paid course with no discount at all", () => {
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, null)).toBeNull();
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, undefined)).toBeNull();
    });

    it("rejects a free course with a discount set — nothing to discount off zero", () => {
      expect(validateCoursePricing(true, null, null, undefined, 20)).not.toBeNull();
    });

    it("rejects an out-of-range or non-integer discount", () => {
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, 0)).not.toBeNull();
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, 100)).not.toBeNull();
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, -10)).not.toBeNull();
      expect(validateCoursePricing(false, 500000, "MONTHLY", undefined, 12.5)).not.toBeNull();
    });
  });
});

describe("getEffectivePriceKobo", () => {
  it("returns priceKobo unchanged when there's no discount", () => {
    expect(getEffectivePriceKobo({ priceKobo: 500000, discountPercent: null })).toBe(500000);
    expect(getEffectivePriceKobo({ priceKobo: 500000 })).toBe(500000);
  });

  it("returns null unchanged for a free course, regardless of discountPercent", () => {
    expect(getEffectivePriceKobo({ priceKobo: null, discountPercent: 20 })).toBeNull();
  });

  it("applies the discount percentage correctly", () => {
    expect(getEffectivePriceKobo({ priceKobo: 500000, discountPercent: 20 })).toBe(400000);
    expect(getEffectivePriceKobo({ priceKobo: 100000, discountPercent: 50 })).toBe(50000);
  });

  it("rounds to the nearest kobo for a discount that doesn't divide evenly", () => {
    expect(getEffectivePriceKobo({ priceKobo: 99999, discountPercent: 33 })).toBe(Math.round((99999 * 67) / 100));
  });
});
