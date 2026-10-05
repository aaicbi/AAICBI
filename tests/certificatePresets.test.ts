import { describe, it, expect } from "vitest";
import { CERTIFICATE_PRESETS, AAICBI_CLASSIC_PRESET } from "../src/lib/certificatePresets";
import { CertificateLayoutSchema } from "../src/lib/certificateLayout";

describe("CERTIFICATE_PRESETS", () => {
  it("has at least four distinct presets", () => {
    expect(CERTIFICATE_PRESETS.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(CERTIFICATE_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(CERTIFICATE_PRESETS.length);
  });

  it("every preset's layout passes CertificateLayoutSchema validation", () => {
    for (const preset of CERTIFICATE_PRESETS) {
      const result = CertificateLayoutSchema.safeParse(preset.layout);
      if (!result.success) {
        throw new Error(`Preset "${preset.name}" (${preset.id}) has an invalid layout: ${JSON.stringify(result.error.flatten())}`);
      }
      expect(result.success).toBe(true);
    }
  });

  it("every preset uses unique element ids within itself", () => {
    for (const preset of CERTIFICATE_PRESETS) {
      const ids = preset.layout.elements.map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("AAICBI Classic is the first preset and is exported as the platform-wide fallback", () => {
    expect(CERTIFICATE_PRESETS[0].id).toBe("aaicbi-classic");
    expect(AAICBI_CLASSIC_PRESET.id).toBe("aaicbi-classic");
  });

  it("AAICBI Classic includes trainee name, course title, and certificate code field bindings", () => {
    const fields = AAICBI_CLASSIC_PRESET.layout.elements
      .filter((el) => el.type === "text" && el.content.kind === "field")
      .map((el) => (el.type === "text" && el.content.kind === "field" ? el.content.field : null));
    expect(fields).toContain("traineeName");
    expect(fields).toContain("credentialTitle");
    expect(fields).toContain("certificateCode");
  });
});
