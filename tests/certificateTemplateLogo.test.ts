import { describe, it, expect } from "vitest";
import { validateCertificateTemplateLogoFile } from "../src/lib/certificateTemplateLogo";

describe("validateCertificateTemplateLogoFile", () => {
  it("accepts a normal JPG under the size limit", () => {
    expect(validateCertificateTemplateLogoFile({ type: "image/jpeg", size: 500_000 })).toBeNull();
  });

  it("accepts PNG and WEBP too", () => {
    expect(validateCertificateTemplateLogoFile({ type: "image/png", size: 500_000 })).toBeNull();
    expect(validateCertificateTemplateLogoFile({ type: "image/webp", size: 500_000 })).toBeNull();
  });

  it("rejects a disallowed type like PDF or GIF", () => {
    expect(validateCertificateTemplateLogoFile({ type: "application/pdf", size: 500_000 })).not.toBeNull();
    expect(validateCertificateTemplateLogoFile({ type: "image/gif", size: 500_000 })).not.toBeNull();
  });

  it("rejects a file over 5MB", () => {
    expect(validateCertificateTemplateLogoFile({ type: "image/jpeg", size: 6 * 1024 * 1024 })).not.toBeNull();
  });

  it("accepts a file at exactly the boundary", () => {
    expect(validateCertificateTemplateLogoFile({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
  });
});
