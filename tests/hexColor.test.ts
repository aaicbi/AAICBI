import { describe, it, expect } from "vitest";
import { hexToRgbTriple } from "../src/lib/hexColor";

describe("hexToRgbTriple", () => {
  it("converts a hex color to a space-separated RGB triple", () => {
    expect(hexToRgbTriple("#016B61")).toBe("1 107 97");
  });

  it("works without a leading #", () => {
    expect(hexToRgbTriple("016B61")).toBe("1 107 97");
  });

  it("converts pure white and black correctly", () => {
    expect(hexToRgbTriple("#FFFFFF")).toBe("255 255 255");
    expect(hexToRgbTriple("#000000")).toBe("0 0 0");
  });

  it("falls back to AAICBI's own brand-teal for a malformed value", () => {
    expect(hexToRgbTriple("not-a-color")).toBe("1 107 97");
    expect(hexToRgbTriple("#ABC")).toBe("1 107 97");
  });
});
