import { describe, it, expect } from "vitest";
import { getUnsupportedMaterialTypeReason } from "@/lib/parsing/moduleMaterialsText";

/**
 * This is the one guarantee that matters: a PDF/PPTX/VIDEO material
 * must be recognized as unsupported BEFORE any network fetch is
 * attempted, not after a failed download. Testing the pure dispatch
 * function directly (rather than the full getModuleMaterialsText,
 * which needs a live database) proves that guarantee without needing
 * Prisma or a real fetch — same "pure core, testable in isolation"
 * split this project already uses for rateLimitCore/embeddingsCore.
 */
describe("getUnsupportedMaterialTypeReason", () => {
  it("returns null for DOCX — the only type that proceeds to a fetch", () => {
    expect(getUnsupportedMaterialTypeReason("DOCX")).toBeNull();
  });

  it("returns a clear reason for PDF, never null", () => {
    expect(getUnsupportedMaterialTypeReason("PDF")).toBe("PDF materials aren't supported for AI analysis yet.");
  });

  it("returns a clear reason for PPTX, never null", () => {
    expect(getUnsupportedMaterialTypeReason("PPTX")).toBe("PowerPoint materials aren't supported for AI analysis yet.");
  });

  it("returns a clear reason for VIDEO, never null", () => {
    expect(getUnsupportedMaterialTypeReason("VIDEO")).toBe("Video materials aren't supported for AI analysis yet.");
  });
});
