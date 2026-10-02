import { describe, it, expect } from "vitest";
import { isModuleIndexInFreePreview } from "../src/lib/courseAccessCore";

describe("isModuleIndexInFreePreview", () => {
  it("is false when the feature is off (null)", () => {
    expect(isModuleIndexInFreePreview(0, null, 5)).toBe(false);
  });

  it("is false when the feature is off (0)", () => {
    expect(isModuleIndexInFreePreview(0, 0, 5)).toBe(false);
  });

  it("includes modules within the configured count", () => {
    expect(isModuleIndexInFreePreview(0, 2, 5)).toBe(true);
    expect(isModuleIndexInFreePreview(1, 2, 5)).toBe(true);
  });

  it("excludes the module at and past the configured count", () => {
    expect(isModuleIndexInFreePreview(2, 2, 5)).toBe(false);
    expect(isModuleIndexInFreePreview(4, 2, 5)).toBe(false);
  });

  it("clamps so a course can never have every module previewable", () => {
    // 3 modules, admin set freePreviewModuleCount to 3 (the whole course) —
    // clamped down to 2, so the last module always stays paid-only.
    expect(isModuleIndexInFreePreview(2, 3, 3)).toBe(false);
    expect(isModuleIndexInFreePreview(1, 3, 3)).toBe(true);
  });

  it("clamps defensively even if freePreviewModuleCount exceeds the actual module count (e.g. a module was deleted after saving)", () => {
    expect(isModuleIndexInFreePreview(0, 10, 2)).toBe(true);
    expect(isModuleIndexInFreePreview(1, 10, 2)).toBe(false); // clamped to 1 (totalModules - 1)
  });

  it("is false for a negative index", () => {
    expect(isModuleIndexInFreePreview(-1, 2, 5)).toBe(false);
  });

  it("is false for every module on a single-module course (clamp floors at 0)", () => {
    expect(isModuleIndexInFreePreview(0, 1, 1)).toBe(false);
  });
});
