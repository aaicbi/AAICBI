import { describe, it, expect } from "vitest";
import { signupLoginUrl, parseSignupNotice, safeInternalPath } from "@/lib/auth/signupRedirect";

const read = (url: string) => { const q = new URL(url, "https://x.test").searchParams; return (k: string) => q.get(k); };

describe("after sign-up", () => {
  it("sends a new member to the sign-in form with a notice and their email", () => {
    const u = signupLoginUrl({ email: " ada@example.com " });
    expect(u.startsWith("/trainee/login?")).toBe(true);
    const n = parseSignupNotice(read(u));
    expect(n).toEqual({ show: true, email: "ada@example.com", startupProblem: false });
  });
  it("keeps where they were going, but only inside the site", () => {
    expect(parseSignupNotice(read(signupLoginUrl({ email: "a@b.co", next: "/courses/1" }))).show).toBe(true);
    expect(signupLoginUrl({ email: "a@b.co", next: "/courses/1" })).toContain("next=%2Fcourses%2F1");
    expect(signupLoginUrl({ email: "a@b.co", next: "https://evil.example" })).not.toContain("next=");
    expect(signupLoginUrl({ email: "a@b.co", next: "//evil.example" })).not.toContain("next=");
    expect(safeInternalPath("/ok")).toBe("/ok");
    expect(safeInternalPath(null)).toBeNull();
  });
  it("never puts something that is not an email address in the link", () => {
    const u = signupLoginUrl({ email: "<script>alert(1)</script>" });
    expect(u).not.toContain("email=");
    expect(parseSignupNotice(read(u)).email).toBe("");
  });
  it("shows the notice only when they just registered, and carries the startup warning", () => {
    expect(parseSignupNotice(() => null).show).toBe(false);
    expect(parseSignupNotice(read("/trainee/login?email=a@b.co")).email).toBe("");
    expect(parseSignupNotice(read(signupLoginUrl({ email: "a@b.co", startupProblem: true }))).startupProblem).toBe(true);
    expect(parseSignupNotice(read("/trainee/login?note=startup-problem")).startupProblem).toBe(false);
  });
});
