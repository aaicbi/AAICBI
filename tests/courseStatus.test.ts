import { describe, it, expect } from "vitest";
import { isCoursePubliclyVisible } from "@/lib/courseStatus";

describe("isCoursePubliclyVisible", () => {
  it("is true only for PUBLISHED", () => {
    expect(isCoursePubliclyVisible("PUBLISHED")).toBe(true);
  });

  it("is false for DRAFT, UNPUBLISHED, and ARCHIVED alike", () => {
    expect(isCoursePubliclyVisible("DRAFT")).toBe(false);
    expect(isCoursePubliclyVisible("UNPUBLISHED")).toBe(false);
    expect(isCoursePubliclyVisible("ARCHIVED")).toBe(false);
  });
});
