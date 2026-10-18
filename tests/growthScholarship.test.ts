import { describe, expect, it } from "vitest";
import { cleanCount, scholarshipBlockers, seatState } from "@/lib/growth/growthCore";

const on = { enabled: true, agreementAt: new Date() };
const base = { platform: on, own: on, orgs: on, organization: on, organizationId: null as string | null, ownScholarships: true, organizationScholarships: true };

describe("scholarshipBlockers", () => {
  it("allows an AAICBI course when platform, own and own-scholarships are on", () => {
    expect(scholarshipBlockers(base)).toEqual([]);
  });
  it("names every closed layer", () => {
    expect(scholarshipBlockers({ ...base, platform: null })).toContain("The platform master switch is off.");
    expect(scholarshipBlockers({ ...base, own: { enabled: false } })).toContain("The AAICBI courses switch is off.");
    expect(scholarshipBlockers({ ...base, ownScholarships: false })).toContain("Scholarship seats are off for AAICBI courses.");
  });
  it("needs the organization's agreement and its scholarship switch for organization courses", () => {
    const org = { ...base, organizationId: "o1" };
    expect(scholarshipBlockers(org)).toEqual([]);
    expect(scholarshipBlockers({ ...org, organization: { enabled: true, agreementAt: null } })).toContain("The organization's agreement is not recorded.");
    expect(scholarshipBlockers({ ...org, organizationScholarships: false })).toContain("Scholarship seats are off for this organization.");
    expect(scholarshipBlockers({ ...org, orgs: { enabled: false } })).toContain("The organization courses switch is off.");
  });
  it("ignores the organization's course switch, so people already started keep their chance", () => {
    expect(scholarshipBlockers({ ...base, organizationId: "o1", organization: { enabled: false, agreementAt: new Date() } })).toEqual([]);
  });
});

describe("seatState", () => {
  it("is closed with no seats", () => {
    expect(seatState({ seats: 0, minPlays: 0, finishedPlays: 50, held: 0 }).open).toBe(false);
  });
  it("waits for enough players", () => {
    const s = seatState({ seats: 10, minPlays: 100, finishedPlays: 40, held: 0 });
    expect(s.open).toBe(false);
    expect(s.reason).toContain("100");
    expect(s.left).toBe(10);
  });
  it("opens at the threshold and counts what is left", () => {
    expect(seatState({ seats: 10, minPlays: 100, finishedPlays: 100, held: 4 })).toEqual({ open: true, left: 6, reason: null });
  });
  it("closes when every seat is held", () => {
    const s = seatState({ seats: 3, minPlays: 0, finishedPlays: 1, held: 3 });
    expect(s.open).toBe(false);
    expect(s.left).toBe(0);
  });
});

describe("cleanCount", () => {
  it("accepts whole numbers and numeric text", () => {
    expect(cleanCount(5)).toBe(5);
    expect(cleanCount(" 12 ")).toBe(12);
    expect(cleanCount(0)).toBe(0);
  });
  it("rejects fractions, negatives, text, blanks and too-large numbers", () => {
    for (const v of [1.5, -1, "abc", "", null, undefined, 1001]) expect(cleanCount(v)).toBeNull();
  });
});
