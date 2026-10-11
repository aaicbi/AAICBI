import { describe, it, expect } from "vitest";
import { appealEffect, canDecide, canEscalate, canReturn, checkReason, matchesFilter, orderQueue, orgMayBlock, parseFilter } from "@/lib/review/reviewCore";

const reviewer = { isSuperAdmin: false };
const boss = { isSuperAdmin: true };
const open = { escalatedAt: null };
const escalated = { escalatedAt: new Date() };

describe("who may decide", () => {
  it("reviewers decide open items", () => expect(canDecide(reviewer, open)).toBe(true));
  it("reviewers cannot decide escalated items", () => expect(canDecide(reviewer, escalated)).toBe(false));
  it("a super admin decides anything", () => {
    expect(canDecide(boss, open)).toBe(true);
    expect(canDecide(boss, escalated)).toBe(true);
  });
});

describe("escalation", () => {
  it("a reviewer can escalate an open item, once", () => {
    expect(canEscalate(reviewer, open)).toBe(true);
    expect(canEscalate(reviewer, escalated)).toBe(false);
  });
  it("a super admin has nobody to escalate to", () => expect(canEscalate(boss, open)).toBe(false));
  it("only a super admin returns an escalated item to the reviewers", () => {
    expect(canReturn(boss, escalated)).toBe(true);
    expect(canReturn(boss, open)).toBe(false);
    expect(canReturn(reviewer, escalated)).toBe(false);
  });
  it("needs a real reason", () => {
    expect(checkReason("").ok).toBe(false);
    expect(checkReason("abc").ok).toBe(false);
    expect(checkReason(7).ok).toBe(false);
    expect(checkReason("x".repeat(1001)).ok).toBe(false);
    expect(checkReason("  The  claim needs a legal check. ")).toEqual({ ok: true, note: "The claim needs a legal check." });
  });
});

describe("the queue", () => {
  const d = (n: number) => new Date(2026, 9, n);
  const items = [
    { id: "a", kind: "POST" as const, waitingSince: d(5), escalated: false },
    { id: "b", kind: "LOOP" as const, waitingSince: d(2), escalated: false },
    { id: "c", kind: "APPEAL" as const, waitingSince: d(9), escalated: true },
    { id: "d", kind: "POST" as const, waitingSince: d(1), escalated: true },
  ];
  it("puts escalated items first, then the longest waiting", () => expect(orderQueue(items).map((i) => i.id)).toEqual(["d", "c", "b", "a"]));
  it("does not change the list it is given", () => { orderQueue(items); expect(items[0].id).toBe("a"); });
  it("filters by kind and escalation", () => {
    expect(items.filter((i) => matchesFilter(i, "posts")).map((i) => i.id)).toEqual(["a", "d"]);
    expect(items.filter((i) => matchesFilter(i, "loop")).map((i) => i.id)).toEqual(["b"]);
    expect(items.filter((i) => matchesFilter(i, "appeals")).map((i) => i.id)).toEqual(["c"]);
    expect(items.filter((i) => matchesFilter(i, "escalated")).map((i) => i.id)).toEqual(["c", "d"]);
    expect(items.filter((i) => matchesFilter(i, "all"))).toHaveLength(4);
  });
  it("reads a filter safely", () => {
    expect(parseFilter("loop")).toBe("loop");
    expect(parseFilter("nonsense")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
  });
});

describe("appeals and organization holds", () => {
  it("lifting an appeal clears the hold, upholding keeps it", () => {
    expect(appealEffect("lift").clearsBlock).toBe(true);
    expect(appealEffect("uphold").clearsBlock).toBe(false);
  });
  it("an organization may hold its own trainees' posts only", () => {
    expect(orgMayBlock({ authorIsOrgTrainee: true, authorIsOrgItself: false })).toBe(true);
    expect(orgMayBlock({ authorIsOrgTrainee: false, authorIsOrgItself: false })).toBe(false);
    expect(orgMayBlock({ authorIsOrgTrainee: true, authorIsOrgItself: true })).toBe(false);
  });
});
