import { describe, it, expect } from "vitest";
import { noticeFor, shouldShowNotice } from "@/lib/guide/visibilityNotice";

describe("visibility notice", () => {
  it("shows once, only for a public profile that was never told", () => {
    expect(shouldShowNotice({ visibility: "PUBLIC", noticeAt: null })).toBe(true);
    expect(shouldShowNotice({ visibility: "PUBLIC", noticeAt: new Date() })).toBe(false);
    expect(shouldShowNotice({ visibility: "PRIVATE", noticeAt: null })).toBe(false);
  });
  it("points each kind at its own visibility control", () => {
    const m = noticeFor("trainee", { visibility: "PUBLIC", noticeAt: null });
    expect(m.href).toBe("/trainee/profile");
    expect(m.target).toBe("profile-visibility");
    const e = noticeFor("employer", { visibility: "PUBLIC", noticeAt: null });
    expect(e.href).toBe("/employer/profile");
    expect(e.target).toBe("company-profile-visibility");
  });
});
