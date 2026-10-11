import { describe, it, expect } from "vitest";
import { DEFAULT_STAFF_PATH, resolveStaffPath, isLegacyStaffLoginEnabled } from "@/lib/staffAccessPath";

describe("the staff sign-in address", () => {
  it("defaults to a path no public page uses", () => {
    expect(resolveStaffPath(undefined)).toEqual({ path: DEFAULT_STAFF_PATH, valid: true, reason: null });
    expect(resolveStaffPath("   ").path).toBe(DEFAULT_STAFF_PATH);
  });
  it("accepts a custom path, lower-cased and without a trailing slash", () => {
    expect(resolveStaffPath("/Team-Door/Sign_In/").path).toBe("/team-door/sign_in");
    expect(resolveStaffPath("/team-door/sign_in").valid).toBe(true);
  });
  it("falls back to the default, with a reason, when the value is unusable", () => {
    for (const bad of ["team-door", "/", "/a", "/x".repeat(60), "/has space/x", "/query?x=1/aaa", "//evil.example/aaa"]) {
      const r = resolveStaffPath(bad);
      expect(r.valid, bad).toBe(false);
      expect(r.path, bad).toBe(DEFAULT_STAFF_PATH);
      expect(r.reason, bad).toBeTruthy();
    }
  });
  it("refuses paths that sit on routes the app already uses", () => {
    for (const bad of ["/admin/staff-door", "/api/staff-door", "/trainee/staff-door", "/feed/staff-door", "/staff-access", "/instructor/door-x", "/_next/door-x"]) expect(resolveStaffPath(bad).valid, bad).toBe(false);
  });
  it("keeps the older /admin/login unless it is switched off", () => {
    expect(isLegacyStaffLoginEnabled(undefined)).toBe(true);
    expect(isLegacyStaffLoginEnabled("on")).toBe(true);
    expect(isLegacyStaffLoginEnabled("OFF")).toBe(false);
    expect(isLegacyStaffLoginEnabled(" off ")).toBe(false);
  });
});
