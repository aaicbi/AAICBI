import { describe, expect, it } from "vitest";
import { FOLLOW_BOOST_MS, MAX_TYPE_RUN, diversify, parseFeedFilter, rankFeed, trendingScore, typesForFilter, type FeedEntry } from "@/lib/ecosystem/feedCore";

const t = (mins: number) => new Date(Date.UTC(2026, 9, 7, 12, 0) - mins * 60_000);
const entry = (key: string, type: FeedEntry["type"], mins: number, followed = false): FeedEntry => ({ key, type, at: t(mins), followed });

describe("parseFeedFilter / typesForFilter", () => {
  it("falls back to all for anything unknown", () => {
    expect(parseFeedFilter(undefined)).toBe("all");
    expect(parseFeedFilter("pitches")).toBe("all");
    expect(parseFeedFilter("jobs")).toBe("jobs");
  });
  it("maps filters to feed types", () => {
    expect(typesForFilter("all")).toEqual(["learn", "organization", "job", "project"]);
    expect(typesForFilter("organizations")).toEqual(["organization"]);
    expect(typesForFilter("learn")).toEqual(["learn"]);
  });
});

describe("trendingScore", () => {
  it("is dampened: 100x the views is nowhere near 100x the score", () => {
    const a = trendingScore({ views: 10, likes: 0, saves: 0, ageDays: 0 });
    const b = trendingScore({ views: 1000, likes: 0, saves: 0, ageDays: 0 });
    expect(b).toBeGreaterThan(a);
    expect(b / a).toBeLessThan(4);
  });
  it("weights deliberate actions above views and decays with age", () => {
    const views = trendingScore({ views: 50, likes: 0, saves: 0, ageDays: 1 });
    const liked = trendingScore({ views: 50, likes: 10, saves: 0, ageDays: 1 });
    const saved = trendingScore({ views: 50, likes: 0, saves: 10, ageDays: 1 });
    expect(liked).toBeGreaterThan(views);
    expect(saved).toBeGreaterThan(liked);
    expect(trendingScore({ views: 50, likes: 10, saves: 0, ageDays: 60 })).toBeLessThan(liked / 2);
  });
  it("never goes negative on bad input", () => {
    expect(trendingScore({ views: -5, likes: -1, saves: -1, ageDays: -3 })).toBeGreaterThanOrEqual(0);
  });
});

describe("diversify", () => {
  it("caps items per group while keeping order", () => {
    const items = ["a1", "a2", "a3", "b1", "a4", "b2"];
    expect(diversify(items, (x) => x[0], 2)).toEqual(["a1", "a2", "b1", "b2"]);
  });
});

describe("rankFeed", () => {
  it("orders newest first", () => {
    const out = rankFeed([entry("old", "learn", 60), entry("new", "job", 5), entry("mid", "project", 30)], 10);
    expect(out.map((e) => e.key)).toEqual(["new", "mid", "old"]);
  });
  it("floats followed organizations up by a few days, but not past something much newer", () => {
    const oneDay = 24 * 60;
    const floated = rankFeed([entry("fresh", "learn", 1), entry("followedYesterday", "learn", oneDay, true)], 10);
    expect(floated[0].key).toBe("followedYesterday");
    const notFloated = rankFeed([entry("fresh", "learn", 1), entry("followedLastWeek", "learn", 7 * oneDay, true)], 10);
    expect(notFloated[0].key).toBe("fresh");
    expect(FOLLOW_BOOST_MS).toBe(3 * oneDay * 60_000);
  });
  it("breaks up long runs of one type when something else is available", () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => entry(`v${i}`, "learn", i)),
      entry("job", "job", 100),
    ];
    const out = rankFeed(items, 10);
    let run = 0;
    let maxRun = 0;
    for (let i = 0; i < out.length; i++) {
      run = i > 0 && out[i].type === out[i - 1].type ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(out.findIndex((e) => e.type === "job")).toBe(MAX_TYPE_RUN);
    // With only one other item the tail is unavoidably all one type.
    expect(out).toHaveLength(7);
  });
  it("respects the limit and is deterministic", () => {
    const items = Array.from({ length: 20 }, (_, i) => entry(`k${i}`, i % 2 ? "learn" : "project", i));
    expect(rankFeed(items, 5)).toHaveLength(5);
    expect(rankFeed(items, 5).map((e) => e.key)).toEqual(rankFeed([...items].reverse(), 5).map((e) => e.key));
  });
});
