import { describe, it, expect } from "vitest";
import { getUnsupportedMaterialTypeReason } from "@/lib/parsing/moduleMaterialsText";

/**
 * A VIDEO material must be recognized as unreadable BEFORE any network fetch is
 * attempted, not after a failed download. Word, PDF and PowerPoint materials
 * proceed to a fetch and are read by parsing/anyDocument.ts.
 */
describe("getUnsupportedMaterialTypeReason", () => {
  it("lets Word, PDF and PowerPoint proceed to a fetch", () => {
    expect(getUnsupportedMaterialTypeReason("DOCX")).toBeNull();
    expect(getUnsupportedMaterialTypeReason("PDF")).toBeNull();
    expect(getUnsupportedMaterialTypeReason("PPTX")).toBeNull();
  });

  it("returns a clear reason for VIDEO, never null", () => {
    expect(getUnsupportedMaterialTypeReason("VIDEO")).toMatch(/Video materials can't be read/);
  });
});
