import { describe, it, expect } from "vitest";
import { pageHasSidebar } from "../src/lib/sidebarRoutes";

describe("pageHasSidebar", () => {
  it("is true for every role's authenticated pages", () => {
    expect(pageHasSidebar("/admin/dashboard")).toBe(true);
    expect(pageHasSidebar("/trainee/dashboard")).toBe(true);
    expect(pageHasSidebar("/employer/dashboard")).toBe(true);
    expect(pageHasSidebar("/investor/dashboard")).toBe(true);
    expect(pageHasSidebar("/instructor/dashboard")).toBe(true);
  });

  it("is false for each role's pre-auth pages", () => {
    expect(pageHasSidebar("/admin/login")).toBe(false);
    expect(pageHasSidebar("/trainee/login")).toBe(false);
    expect(pageHasSidebar("/trainee/register")).toBe(false);
    expect(pageHasSidebar("/trainee/verify")).toBe(false);
    expect(pageHasSidebar("/employer/register")).toBe(false);
    expect(pageHasSidebar("/investor/reset-password")).toBe(false);
  });

  it("is true for instructor's dashboard even though it has no pre-auth pages at all", () => {
    expect(pageHasSidebar("/instructor/courses")).toBe(true);
  });

  it("is false for public and unrelated pages", () => {
    expect(pageHasSidebar("/")).toBe(false);
    expect(pageHasSidebar("/courses")).toBe(false);
    expect(pageHasSidebar("/courses/abc123")).toBe(false);
  });

  it("treats nested authenticated routes the same as their section root", () => {
    expect(pageHasSidebar("/trainee/courses/abc123")).toBe(true);
    expect(pageHasSidebar("/admin/staff")).toBe(true);
  });
});
