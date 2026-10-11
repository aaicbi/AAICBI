import { describe, expect, it } from "vitest";
import { emptyPanels, hasPanels, pickOrganizations } from "@/lib/ecosystem/discovery";
import type { LandingOrg } from "@/lib/landing/types";

const org = (id: string, featured: boolean): LandingOrg => ({ id, name: id, slug: id, logoUrl: null, tagline: null, location: null, verified: false, featured, badges: [], skills: [], programCount: 0, videoCount: 0, href: `/organizations/${id}`, at: null, isSample: false });

describe("discovery panels", () => {
  it("puts featured organizations first and limits the count", () => {
    const got = pickOrganizations([org("a", false), org("b", true), org("c", false), org("d", true)], 3);
    expect(got.map((o) => o.id)).toEqual(["b", "d", "a"]);
  });
  it("knows when there is nothing to show", () => {
    expect(hasPanels(emptyPanels())).toBe(false);
    expect(hasPanels({ ...emptyPanels(), events: [{ id: "e", title: "t", startsAt: null, locationText: null, organizationName: "o", href: "/events", isSample: false }] })).toBe(true);
  });
});
