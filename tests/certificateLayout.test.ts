import { describe, it, expect } from "vitest";
import { resolveFieldValue, CertificateLayoutSchema, type CertificateRenderData } from "../src/lib/certificateLayout";

const data: CertificateRenderData = {
  traineeName: "Jane Doe",
  verb: "has successfully completed",
  credentialTitle: "Intro to AI",
  issuedAt: "5 October 2026",
  certificateCode: "AAICBI-ABCD-1234",
  organizationName: "Acme Academy",
  signatoryName: "Dr. Smith",
  signatoryTitle: "Director of Training",
};

describe("resolveFieldValue", () => {
  it("resolves every dynamic field to its matching data value", () => {
    expect(resolveFieldValue("traineeName", data)).toBe("Jane Doe");
    expect(resolveFieldValue("verb", data)).toBe("has successfully completed");
    expect(resolveFieldValue("credentialTitle", data)).toBe("Intro to AI");
    expect(resolveFieldValue("issuedAt", data)).toBe("5 October 2026");
    expect(resolveFieldValue("certificateCode", data)).toBe("AAICBI-ABCD-1234");
    expect(resolveFieldValue("organizationName", data)).toBe("Acme Academy");
    expect(resolveFieldValue("signatoryName", data)).toBe("Dr. Smith");
    expect(resolveFieldValue("signatoryTitle", data)).toBe("Director of Training");
  });
});

const minimalLayout = { width: 1000, height: 700, backgroundColor: "#FFFFFF", elements: [] };

describe("CertificateLayoutSchema", () => {
  it("accepts a valid minimal layout", () => {
    expect(CertificateLayoutSchema.safeParse(minimalLayout).success).toBe(true);
  });

  it("accepts a valid text element bound to a literal string", () => {
    const layout = {
      ...minimalLayout,
      elements: [
        {
          id: "a", type: "text", x: 10, y: 10, width: 200, rotation: 0,
          fontSize: 24, fontFamily: "Georgia", bold: false, italic: false,
          color: "#000000", align: "left",
          content: { kind: "literal", text: "Hello" },
        },
      ],
    };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("accepts a valid text element bound to a dynamic field", () => {
    const layout = {
      ...minimalLayout,
      elements: [
        {
          id: "a", type: "text", x: 10, y: 10, width: 200, rotation: 0,
          fontSize: 24, fontFamily: "Georgia", bold: false, italic: false,
          color: "#000000", align: "center",
          content: { kind: "field", field: "traineeName" },
        },
      ],
    };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("accepts a valid image element", () => {
    const layout = {
      ...minimalLayout,
      elements: [{ id: "a", type: "image", x: 0, y: 0, width: 100, height: 100, rotation: 0, source: "logo" }],
    };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("accepts a valid shape element", () => {
    const layout = {
      ...minimalLayout,
      elements: [{ id: "a", type: "shape", shapeType: "rect", x: 0, y: 0, width: 100, height: 50, rotation: 0, fill: "#FFFFFF", strokeWidth: 2 }],
    };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("rejects a font size outside the allowed range", () => {
    const layout = {
      ...minimalLayout,
      elements: [
        {
          id: "a", type: "text", x: 10, y: 10, width: 200, rotation: 0,
          fontSize: 999, fontFamily: "Georgia", bold: false, italic: false,
          color: "#000000", align: "left",
          content: { kind: "literal", text: "Hello" },
        },
      ],
    };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(false);
  });

  it("rejects an unknown dynamic field name", () => {
    const layout = {
      ...minimalLayout,
      elements: [
        {
          id: "a", type: "text", x: 10, y: 10, width: 200, rotation: 0,
          fontSize: 24, fontFamily: "Georgia", bold: false, italic: false,
          color: "#000000", align: "left",
          content: { kind: "field", field: "notARealField" },
        },
      ],
    };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(false);
  });

  it("rejects an invalid hex color", () => {
    const layout = { ...minimalLayout, backgroundColor: "red" };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(false);
  });

  it("rejects an unknown element type", () => {
    const layout = { ...minimalLayout, elements: [{ id: "a", type: "video", x: 0, y: 0, rotation: 0 }] };
    expect(CertificateLayoutSchema.safeParse(layout).success).toBe(false);
  });

  it("rejects a layout whose dimensions are out of bounds", () => {
    expect(CertificateLayoutSchema.safeParse({ ...minimalLayout, width: 10 }).success).toBe(false);
    expect(CertificateLayoutSchema.safeParse({ ...minimalLayout, width: 100_000 }).success).toBe(false);
  });
});
