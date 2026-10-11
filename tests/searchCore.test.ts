import { describe, it, expect } from "vitest";
import { parseSearchParams, rankText, orderHits, pageOf, searchHref, hasCriteria, activeFilters, FILTERS_FOR_KIND, SEARCH_KINDS, normalizeQuery, MAX_QUERY } from "@/lib/ecosystem/searchCore";

describe("reading a search request", () => {
  it("falls back to safe defaults for anything unknown", () => {
    const p = parseSearchParams({ kind: "admins", sort: "random", page: "-4", type: "<script>", q: "x" });
    expect(p).toMatchObject({ kind: "all", sort: "relevance", page: 1, type: null, q: null });
  });
  it("covers every kind of result the platform has, including employers, investors, startups and jobs", () => {
    expect(SEARCH_KINDS).toEqual(expect.arrayContaining(["people", "organizations", "employers", "investors", "startups", "jobs", "programs", "posts", "videos", "events"]));
  });
  it("trims, collapses spaces and caps lengths and pages", () => {
    const p = parseSearchParams({ q: "  data    analytics  ", skill: " python ", location: "x".repeat(500), page: "9999" });
    expect(p.q).toBe("data analytics");
    expect(p.skill).toBe("python");
    expect(p.location!.length).toBe(60);
    expect(p.page).toBe(50);
    expect(normalizeQuery("a".repeat(500))!.length).toBe(MAX_QUERY);
    expect(normalizeQuery(" a ")).toBeNull();
  });
  it("takes the first value when a parameter is repeated", () => {
    expect(parseSearchParams({ kind: ["jobs", "people"] }).kind).toBe("jobs");
  });
  it("lets a filter alone make a search", () => {
    expect(hasCriteria(parseSearchParams({ skill: "python", kind: "people" }))).toBe(true);
    expect(hasCriteria(parseSearchParams({}))).toBe(false);
  });
  it("offers each filter only to the kinds it makes sense for", () => {
    expect(FILTERS_FOR_KIND.people).toEqual(["skill", "location"]);
    expect(FILTERS_FOR_KIND.startups).toEqual(["industry", "location"]);
    expect(FILTERS_FOR_KIND.jobs).toEqual(["skill"]);
    expect(FILTERS_FOR_KIND.all).toEqual([]);
    expect(activeFilters(parseSearchParams({ kind: "jobs", skill: "sql", location: "Lagos" }))).toEqual(["skill"]);
  });
});

describe("ranking a match", () => {
  it("puts an exact name above a prefix, a word inside, and a match in another field", () => {
    const q = "data";
    const exact = rankText(q, ["Data"]);
    const prefix = rankText(q, ["Data Labs"]);
    const word = rankText(q, ["African data hub"]);
    const inside = rankText(q, ["Metadata Co"]);
    const other = rankText(q, ["Zeta Co", "We do data work"]);
    expect([exact, prefix, word, inside, other].every((n, i, a) => i === 0 || a[i - 1] > n)).toBe(true);
    expect(rankText(q, ["Nothing here", null])).toBe(0);
  });
  it("ignores case, accents, a leading @ or #", () => {
    expect(rankText("ola", ["Ọla"])).toBe(100); // marks such as the dot under Ọ do not get in the way of finding a name
    expect(rankText("jose", ["José Silva"])).toBe(80);
    expect(rankText("@kora", ["kora-analytics"])).toBe(80);
    expect(rankText("#data", ["Data"])).toBe(100);
  });
  it("is not fooled by characters that mean something in a pattern", () => {
    expect(() => rankText("(a+", ["a (a+ b"])).not.toThrow();
    expect(rankText("c++", ["I write c++ daily"])).toBeGreaterThan(0);
  });
  it("orders by relevance then newest, or by newest alone", () => {
    const hits = [{ id: "old-best", rank: 80, at: 1 }, { id: "new-ok", rank: 40, at: 3 }, { id: "new-best", rank: 80, at: 2 }];
    expect(orderHits(hits, "relevance").map((h) => h.id)).toEqual(["new-best", "old-best", "new-ok"]);
    expect(orderHits(hits, "recent").map((h) => h.id)).toEqual(["new-ok", "new-best", "old-best"]);
  });
});

describe("paging and links", () => {
  it("returns a page and says whether more follow", () => {
    const all = Array.from({ length: 30 }, (_, i) => i);
    expect(pageOf(all, 1, 12)).toEqual({ items: all.slice(0, 12), hasMore: true });
    expect(pageOf(all, 3, 12)).toEqual({ items: all.slice(24, 30), hasMore: false });
    expect(pageOf(all, 9, 12).items).toEqual([]);
  });
  it("keeps the request in a link and leaves out defaults and filters of other kinds", () => {
    const p = parseSearchParams({ q: "data", kind: "people", skill: "python", location: "Lagos", industry: "Health", sort: "recent", page: "2" });
    expect(searchHref(p)).toBe("/search?q=data&kind=people&skill=python&location=Lagos&sort=recent&page=2");
    expect(searchHref(p, { kind: "all", page: 1 })).toBe("/search?q=data&sort=recent");
    expect(searchHref(parseSearchParams({}))).toBe("/search");
  });
});
