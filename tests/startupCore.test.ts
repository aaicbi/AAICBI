import { describe, it, expect } from "vitest";
import { StartupInputSchema, can, canSubmit, isPublic, missingForSubmit, nextStatus, wouldLeaveNoFounder } from "@/lib/startups/startupCore";

const active = (o: Partial<{ role: "FOUNDER" | "MEMBER"; canEdit: boolean; canPublish: boolean; status: string }> = {}) => ({ role: "MEMBER" as const, canEdit: false, canPublish: false, status: "ACTIVE", ...o });

describe("startup profile input", () => {
  it("accepts a minimal startup and fills defaults", () => {
    const r = StartupInputSchema.parse({ name: "Kuda Health" });
    expect(r).toMatchObject({ name: "Kuda Health", stage: "IDEA", seeking: [], tagline: null, website: null, industry: null });
  });
  it("needs a real name and a proper web address", () => {
    expect(StartupInputSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(StartupInputSchema.safeParse({ name: "Kuda", website: "kuda.com" }).success).toBe(false);
    expect(StartupInputSchema.safeParse({ name: "Kuda", website: "https://kuda.example.com" }).success).toBe(true);
    expect(StartupInputSchema.safeParse({ name: "Kuda", website: "javascript:alert(1)" }).success).toBe(false);
  });
  it("limits lengths, industries and the things a startup can seek", () => {
    expect(StartupInputSchema.safeParse({ name: "Kuda", tagline: "x".repeat(121) }).success).toBe(false);
    expect(StartupInputSchema.safeParse({ name: "Kuda", industry: "Crypto casinos" }).success).toBe(false);
    expect(StartupInputSchema.parse({ name: "Kuda", seeking: ["FUNDING", "FUNDING", "HIRING"] }).seeking).toEqual(["FUNDING", "HIRING"]);
    expect(StartupInputSchema.safeParse({ name: "Kuda", seeking: ["MONEY"] }).success).toBe(false);
  });
});

describe("what is needed before review", () => {
  it("lists what is missing", () => {
    expect(missingForSubmit({ tagline: null, problem: null, solution: null, industry: null })).toHaveLength(4);
    expect(missingForSubmit({ tagline: "t", problem: "p", solution: "s", industry: "Health" })).toEqual([]);
  });
});

describe("what a team member may do", () => {
  it("founders may do everything", () => {
    for (const a of ["view_private", "edit", "publish", "manage_team", "submit"] as const) expect(can(active({ role: "FOUNDER" }), a)).toBe(true);
  });
  it("ordinary members only do what a founder allowed", () => {
    expect(can(active(), "edit")).toBe(false);
    expect(can(active({ canEdit: true }), "edit")).toBe(true);
    expect(can(active({ canPublish: true }), "publish")).toBe(true);
    expect(can(active({ canEdit: true, canPublish: true }), "manage_team")).toBe(false);
    expect(can(active({ canEdit: true, canPublish: true }), "submit")).toBe(false);
    expect(can(active(), "view_private")).toBe(true);
  });
  it("an invited person, or a stranger, can do nothing yet", () => {
    expect(can(active({ role: "FOUNDER", status: "INVITED" }), "edit")).toBe(false);
    expect(can(null, "view_private")).toBe(false);
  });
});

describe("review status", () => {
  it("is public only when approved", () => {
    expect(isPublic("APPROVED")).toBe(true);
    for (const s of ["DRAFT", "PENDING", "REJECTED", "SUSPENDED"]) expect(isPublic(s)).toBe(false);
  });
  it("can be sent for review from draft or after a rejection", () => {
    expect(canSubmit("DRAFT")).toBe(true);
    expect(canSubmit("REJECTED")).toBe(true);
    for (const s of ["PENDING", "APPROVED", "SUSPENDED"]) expect(canSubmit(s)).toBe(false);
  });
  it("follows the allowed admin transitions", () => {
    expect(nextStatus("PENDING", "approve", null)).toEqual({ ok: true, status: "APPROVED" });
    expect(nextStatus("DRAFT", "approve", null).ok).toBe(false);
    expect(nextStatus("SUSPENDED", "reinstate", null)).toEqual({ ok: true, status: "APPROVED" });
    expect(nextStatus("APPROVED", "reinstate", null).ok).toBe(false);
  });
  it("needs a reason to reject or suspend", () => {
    expect(nextStatus("PENDING", "reject", "").ok).toBe(false);
    expect(nextStatus("PENDING", "reject", "Not enough detail about the product.")).toEqual({ ok: true, status: "REJECTED" });
    expect(nextStatus("APPROVED", "suspend", "abc").ok).toBe(false);
    expect(nextStatus("APPROVED", "suspend", "Reported for misleading claims.")).toEqual({ ok: true, status: "SUSPENDED" });
  });
});

describe("the team always keeps a founder", () => {
  const team = [{ id: "a", role: "FOUNDER", status: "ACTIVE" }, { id: "b", role: "FOUNDER", status: "ACTIVE" }, { id: "c", role: "MEMBER", status: "ACTIVE" }, { id: "d", role: "FOUNDER", status: "INVITED" }];
  it("allows removing one of two founders", () => expect(wouldLeaveNoFounder(team, "a")).toBe(false));
  it("refuses removing the last active founder", () => expect(wouldLeaveNoFounder(team.filter((m) => m.id !== "b"), "a")).toBe(true));
});
