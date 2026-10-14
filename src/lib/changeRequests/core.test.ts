import { describe, expect, it } from "vitest";
import { buildBrief, canMove, cleanRequestInput, cleanUrl } from "@/lib/changeRequests/core";

describe("change requests", () => {
  it("needs a title and real details", () => {
    expect(cleanRequestInput({ title: "x", details: "long enough details" }).ok).toBe(false);
    expect(cleanRequestInput({ title: "Show numbers", details: "short" }).ok).toBe(false);
    const ok = cleanRequestInput({ title: "  Show numbers  ", details: "Show module numbers in the list.", page: " /admin/studio " });
    expect(ok.ok && ok.value).toEqual({ title: "Show numbers", details: "Show module numbers in the list.", page: "/admin/studio" });
  });
  it("only allows the moves a Super Admin should make", () => {
    expect(canMove("PROPOSED", "APPROVED")).toBe(true);
    expect(canMove("PROPOSED", "DONE")).toBe(false);
    expect(canMove("APPROVED", "DONE")).toBe(true);
    expect(canMove("DONE", "APPROVED")).toBe(false);
    expect(canMove("DECLINED", "PROPOSED")).toBe(true);
  });
  it("stores only web links", () => {
    expect(cleanUrl("https://github.com/a/b/pull/1")).toBe("https://github.com/a/b/pull/1");
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("not a url")).toBeNull();
  });
  it("builds a brief that tells Claude Code to open a pull request and not to merge", () => {
    const md = buildBrief([{ id: "r1", title: "T", details: "Do the thing", page: null, decisionNote: "Only on desktop", author: "Ada", decidedBy: "Chidi", decidedAt: new Date("2026-10-13") }], new Date("2026-10-14"));
    expect(md).toContain("## 1. T");
    expect(md).toContain("Agreed: Only on desktop");
    expect(md).toMatch(/open a pull request/);
    expect(md).toMatch(/Do not merge or deploy/);
    expect(buildBrief([])).toContain("no approved requests");
  });
});
