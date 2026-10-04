import { describe, it, expect } from "vitest";
import { generateTemplateReviewToken } from "../src/lib/certificateTemplateReview";

describe("generateTemplateReviewToken", () => {
  it("has the CERTTPL-XXXX-XXXX shape", () => {
    const alphabet = "[ABCDEFGHJKMNPQRSTUVWXYZ2-9]";
    expect(generateTemplateReviewToken()).toMatch(new RegExp(`^CERTTPL-${alphabet}{4}-${alphabet}{4}$`));
  });

  it("excludes the ambiguous 0/O/1/I/L characters from its random portion", () => {
    const token = generateTemplateReviewToken();
    const randomPortion = token.replace("CERTTPL-", "");
    expect(randomPortion).not.toMatch(/[0O1IL]/);
  });

  it("generates a different token on each call", () => {
    const a = generateTemplateReviewToken();
    const b = generateTemplateReviewToken();
    expect(a).not.toBe(b);
  });
});
