import { describe, expect, it } from "vitest";
import { TASTER_SIZE, answerGrid, beatPercent, bpsToPercent, checkLead, cleanEmail, cleanSource, effectivePreviewCount, isCampaignSlug, normalizePhone, percentToBps, readinessIssues, slugify, switchBlockers, tasterRank } from "@/lib/growth/growthCore";

const on = { enabled: true, agreementAt: new Date() };
const base = { platform: on, own: on, orgs: on, organization: on, organizationId: null as string | null, campaignEnabled: true };

describe("growth switches", () => {
  it("lets an AAICBI course through when the master, own and course switches are on", () => {
    expect(switchBlockers(base)).toEqual([]);
  });
  it("blocks everything when the master switch is off", () => {
    expect(switchBlockers({ ...base, platform: { enabled: false } })).toContain("The platform master switch is off.");
    expect(switchBlockers({ ...base, platform: null })).toContain("The platform master switch is off.");
  });
  it("uses the own switch for AAICBI courses and ignores the organization rows", () => {
    expect(switchBlockers({ ...base, own: { enabled: false }, orgs: { enabled: true } })).toEqual(["The AAICBI courses switch is off."]);
  });
  it("needs the organization courses switch, the organization's switch and its agreement for an organization course", () => {
    const org = { ...base, organizationId: "o1" };
    expect(switchBlockers(org)).toEqual([]);
    expect(switchBlockers({ ...org, orgs: { enabled: false } })).toEqual(["The organization courses switch is off."]);
    expect(switchBlockers({ ...org, organization: { enabled: false } })).toEqual(["This organization's switch is off."]);
    expect(switchBlockers({ ...org, organization: { enabled: true, agreementAt: null } })).toEqual(["The organization's agreement is not recorded."]);
    expect(switchBlockers({ ...org, own: { enabled: false } })).toEqual([]);
  });
  it("needs the course's own opt-in", () => {
    expect(switchBlockers({ ...base, campaignEnabled: false })).toEqual(["This course's own switch is off."]);
  });
});

describe("readiness", () => {
  const ok = { published: true, hasModule: true, hasAssessment: true, usableQuestions: 12, approvedTaster: TASTER_SIZE, approvedStillUsable: TASTER_SIZE };
  it("is ready when everything is in place", () => expect(readinessIssues(ok)).toEqual([]));
  it("lists what is missing", () => {
    expect(readinessIssues({ ...ok, published: false })[0]).toMatch(/not published/);
    expect(readinessIssues({ ...ok, hasModule: false })).toEqual(["The course has no module 1."]);
    expect(readinessIssues({ ...ok, hasAssessment: false })).toEqual(["Module 1 has no assessment."]);
    expect(readinessIssues({ ...ok, usableQuestions: 3 })[0]).toMatch(/needs at least 5 .* has 3/);
    expect(readinessIssues({ ...ok, approvedTaster: 2, approvedStillUsable: 2 })[0]).toMatch(/approved 2 of 5/);
  });
  it("asks for re-approval when an approved question disappeared", () => {
    expect(readinessIssues({ ...ok, approvedStillUsable: 4 })[0]).toMatch(/approve the taster again/);
  });
});

describe("taster result", () => {
  it("ranks by the share correct", () => {
    expect(tasterRank(5, 5).key).toBe("GOLD");
    expect(tasterRank(4, 5).key).toBe("SILVER");
    expect(tasterRank(2, 5).key).toBe("BRONZE");
    expect(tasterRank(3, 5).key).toBe("BRONZE");
    expect(tasterRank(1, 5).key).toBe("NEWCOMER");
    expect(tasterRank(0, 0).key).toBe("NEWCOMER");
  });
  it("only claims a percentile when enough people played", () => {
    expect(beatPercent(4, [1, 2, 3])).toBeNull();
    const scores = [...Array(20).fill(2), ...Array(10).fill(5)];
    expect(beatPercent(5, scores)).toBe(67);
    expect(beatPercent(2, scores)).toBe(0);
  });
  it("draws a grid with one square per question", () => {
    expect(answerGrid([true, false, true])).toBe("🟩🟥🟩");
  });
});

describe("links and sources", () => {
  it("makes safe slugs", () => {
    expect(slugify("Orbit Academy: AI Automation!")).toBe("orbit-academy-ai-automation");
    expect(slugify("  Café   Données ")).toBe("cafe-donnees");
    expect(slugify("!!!")).toBe("course");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(48);
    expect(isCampaignSlug("orbit-ai-automation")).toBe(true);
    expect(isCampaignSlug("Bad Slug")).toBe(false);
  });
  it("cleans a share source", () => {
    expect(cleanSource("Lagos Tech Women!!")).toBe("lagos-tech-women");
    expect(cleanSource("   ")).toBeNull();
    expect(cleanSource(5)).toBeNull();
    expect(cleanSource("x".repeat(200))!.length).toBe(40);
  });
});

describe("commission", () => {
  it("stores percentages as basis points", () => {
    expect(percentToBps(15)).toBe(1500);
    expect(percentToBps("12.5")).toBe(1250);
    expect(percentToBps(0)).toBe(0);
    expect(percentToBps(101)).toBeNull();
    expect(percentToBps(-1)).toBeNull();
    expect(percentToBps("abc")).toBeNull();
    expect(bpsToPercent(1500)).toBe(15);
    expect(bpsToPercent(null)).toBeNull();
  });
});

describe("saving a score", () => {
  it("normalizes Nigerian numbers to +234", () => {
    expect(normalizePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalizePhone("8031234567")).toBe("+2348031234567");
    expect(normalizePhone("+234 803 123 4567")).toBe("+2348031234567");
    expect(normalizePhone("2348031234567")).toBe("+2348031234567");
    expect(normalizePhone("0903-123-4567")).toBe("+2349031234567");
  });
  it("keeps other international numbers and refuses junk", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("0603 123 4567")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(42)).toBeNull();
    expect(normalizePhone("+123")).toBeNull();
  });
  it("cleans emails", () => {
    expect(cleanEmail(" Ada@Example.COM ")).toBe("ada@example.com");
    expect(cleanEmail("ada@")).toBeNull();
    expect(cleanEmail("a b@c.de")).toBeNull();
  });
  it("needs consent and a way to reach the person", () => {
    expect(checkLead({ phone: "0803 123 4567", consent: false }).ok).toBe(false);
    expect(checkLead({ consent: true }).ok).toBe(false);
    expect(checkLead({ phone: "0803 123 4567", consent: true })).toEqual({ ok: true, phone: "+2348031234567", email: null });
    expect(checkLead({ email: "ada@example.com", consent: true })).toEqual({ ok: true, phone: null, email: "ada@example.com" });
  });
  it("refuses a number or email that was given but is wrong, even if the other is fine", () => {
    expect(checkLead({ phone: "123", email: "ada@example.com", consent: true }).ok).toBe(false);
    expect(checkLead({ phone: "0803 123 4567", email: "nope", consent: true }).ok).toBe(false);
  });
});

describe("module 1 access", () => {
  it("opens the larger of the course preview and the funnel grant", () => {
    expect(effectivePreviewCount(null, null)).toBe(0);
    expect(effectivePreviewCount(null, 1)).toBe(1);
    expect(effectivePreviewCount(2, 1)).toBe(2);
    expect(effectivePreviewCount(0, undefined)).toBe(0);
  });
});
