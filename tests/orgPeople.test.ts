import { describe, expect, it } from "vitest";
import { describeAction, mayDo, worthLogging } from "@/lib/org/people";

const ok = (r: string, m: string, p: string) => mayDo(r as never, m, p).ok;

describe("what each person in an organization may do", () => {
  it("the owner can do everything, including billing", () => {
    expect(ok("OWNER", "DELETE", "/api/courses/abc")).toBe(true);
    expect(ok("OWNER", "POST", "/api/org/billing/pay")).toBe(true);
    expect(ok("OWNER", "POST", "/api/org/members")).toBe(true);
  });
  it("a manager can do everything except billing", () => {
    expect(ok("MANAGER", "DELETE", "/api/courses/abc")).toBe(true);
    expect(ok("MANAGER", "POST", "/api/exams/e1/publish")).toBe(true);
    expect(ok("MANAGER", "POST", "/api/org/members")).toBe(true);
    expect(ok("MANAGER", "POST", "/api/org/billing/pay")).toBe(false);
  });
  it("an editor builds content but cannot publish, delete, or touch the team, profile or billing", () => {
    expect(ok("EDITOR", "PUT", "/api/courses/abc")).toBe(true);
    expect(ok("EDITOR", "POST", "/api/courses/abc/modules")).toBe(true);
    expect(ok("EDITOR", "POST", "/api/exams/e1/questions")).toBe(true);
    expect(ok("EDITOR", "POST", "/api/posts")).toBe(true);
    expect(ok("EDITOR", "DELETE", "/api/courses/abc")).toBe(false);
    expect(ok("EDITOR", "DELETE", "/api/exams/e1")).toBe(false);
    expect(ok("EDITOR", "POST", "/api/exams/e1/publish")).toBe(false);
    expect(ok("EDITOR", "POST", "/api/admin/assignments/a1/publish")).toBe(false);
    expect(ok("EDITOR", "POST", "/api/org/members")).toBe(false);
    expect(ok("EDITOR", "PUT", "/api/org/profile")).toBe(false);
    expect(ok("EDITOR", "POST", "/api/org/billing/pay")).toBe(false);
    // deleting a lesson or module is editing the course, not deleting the course
    expect(ok("EDITOR", "DELETE", "/api/modules/m1")).toBe(true);
  });
  it("a viewer can read everything and change nothing, but can still sign out and read notifications", () => {
    expect(ok("VIEWER", "GET", "/api/courses/abc")).toBe(true);
    expect(ok("VIEWER", "PUT", "/api/courses/abc")).toBe(false);
    expect(ok("VIEWER", "POST", "/api/posts")).toBe(false);
    expect(ok("VIEWER", "POST", "/api/auth/logout")).toBe(true);
    expect(ok("VIEWER", "POST", "/api/notifications/read")).toBe(true);
    expect(ok("VIEWER", "POST", "/api/guide/chat")).toBe(true);
  });
  it("gives a reason a person can act on", () => {
    const v = mayDo("VIEWER", "PUT", "/api/courses/abc");
    expect(!v.ok && v.reason).toMatch(/owner/i);
  });
});

describe("the activity log", () => {
  it("describes what was done in plain words", () => {
    expect(describeAction("PUT", "/api/courses/abc")).toBe("Edited a course");
    expect(describeAction("POST", "/api/courses/abc/modules")).toBe("Created or changed a module");
    expect(describeAction("POST", "/api/exams/e1/publish")).toBe("Published an examination");
    expect(describeAction("DELETE", "/api/admin/assignments/a1")).toBe("Deleted an assignment");
    expect(describeAction("PATCH", "/api/org/members/m1")).toBe("Edited the team");
  });
  it("records changes, not reading or chatting", () => {
    expect(worthLogging("GET", "/api/courses")).toBe(false);
    expect(worthLogging("POST", "/api/guide/chat")).toBe(false);
    expect(worthLogging("POST", "/api/auth/logout")).toBe(false);
    expect(worthLogging("PUT", "/api/courses/abc")).toBe(true);
  });
});
