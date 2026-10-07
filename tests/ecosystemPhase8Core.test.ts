import { describe, expect, it } from "vitest";
import { CommentSchema, cleanComment, containsLink } from "@/lib/ecosystem/commentCore";
import { EventSchema, isUpcoming, startsTooEarly } from "@/lib/ecosystem/eventCore";
import { normalizeQuery, parseKind } from "@/lib/ecosystem/searchCore";

describe("comments", () => {
  it("cleans whitespace and accepts ordinary text", () => {
    expect(cleanComment("  nice   video \n thanks ")).toBe("nice video thanks");
    expect(CommentSchema.safeParse({ body: "  Great   explanation!  " })).toMatchObject({ success: true, data: { body: "Great explanation!" } });
  });
  it("rejects links, empty and very long comments", () => {
    for (const body of ["visit https://spam.example", "go to www.spam.io now", "buy at cheap.com", "", "a", "x".repeat(501)]) {
      expect(CommentSchema.safeParse({ body }).success).toBe(false);
    }
    expect(containsLink("loved the sql.joins part")).toBe(false);
  });
});

describe("events", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const base = { title: "Open day", startsAt: "2026-11-01T10:00:00Z" };
  it("accepts a simple event and an https registration link", () => {
    expect(EventSchema.safeParse(base).success).toBe(true);
    expect(EventSchema.safeParse({ ...base, registrationUrl: "https://example.com/r" }).success).toBe(true);
  });
  it("rejects http or script links, an end before the start, and a missing title", () => {
    expect(EventSchema.safeParse({ ...base, registrationUrl: "http://example.com" }).success).toBe(false);
    expect(EventSchema.safeParse({ ...base, registrationUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(EventSchema.safeParse({ ...base, endsAt: "2026-10-01T10:00:00Z" }).success).toBe(false);
    expect(EventSchema.safeParse({ ...base, title: "x" }).success).toBe(false);
  });
  it("lists events until they are over", () => {
    expect(isUpcoming({ startsAt: new Date("2026-10-07T09:00:00Z") }, now)).toBe(true); // same-day, no end
    expect(isUpcoming({ startsAt: new Date("2026-10-05T09:00:00Z") }, now)).toBe(false);
    expect(isUpcoming({ startsAt: new Date("2026-10-05T09:00:00Z"), endsAt: new Date("2026-10-08T09:00:00Z") }, now)).toBe(true);
  });
  it("blocks creating events well in the past", () => {
    expect(startsTooEarly(new Date("2026-09-01T00:00:00Z"), now)).toBe(true);
    expect(startsTooEarly(new Date("2026-10-07T00:00:00Z"), now)).toBe(false);
  });
});

describe("search", () => {
  it("normalizes and rejects queries that are too short", () => {
    expect(normalizeQuery("  data   analytics ")).toBe("data analytics");
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery("x".repeat(200))?.length).toBe(80);
  });
  it("falls back to all for unknown kinds", () => {
    expect(parseKind("videos")).toBe("videos");
    expect(parseKind("evil")).toBe("all");
    expect(parseKind(undefined)).toBe("all");
  });
});
