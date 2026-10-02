import { describe, it, expect } from "vitest";
import { getTourGuideContent, DEFAULT_TOUR_ENTRY } from "../src/lib/tourGuideContent";

describe("getTourGuideContent", () => {
  it("matches an exact static page", () => {
    expect(getTourGuideContent("/trainee/dashboard").title).toBe("Your Dashboard");
  });

  it("matches a dynamic course-detail page without matching the list page", () => {
    expect(getTourGuideContent("/trainee/courses/abc123").title).toBe("Course Content");
    expect(getTourGuideContent("/trainee/courses").title).toBe("Your Courses");
  });

  it("does not match a page nested deeper than any known pattern", () => {
    // e.g. the exam-taking flow under a course — not in the content
    // table, should fall through to the honest default rather than a
    // wrong course-detail match.
    expect(getTourGuideContent("/trainee/courses/abc123/examination/take")).toBe(DEFAULT_TOUR_ENTRY);
  });

  it("falls back to the default entry for any uncovered page", () => {
    expect(getTourGuideContent("/some/totally/unrelated/path")).toBe(DEFAULT_TOUR_ENTRY);
  });

  it("matches the public course catalogue and its detail page distinctly", () => {
    expect(getTourGuideContent("/courses").title).toBe("Course Catalogue");
    expect(getTourGuideContent("/courses/xyz").title).toBe("Course Details");
  });

  it("matches the root path exactly, not every path", () => {
    expect(getTourGuideContent("/").title).toBe("Welcome to AAICBI");
    expect(getTourGuideContent("/trainee/login")).toBe(DEFAULT_TOUR_ENTRY);
  });
});
