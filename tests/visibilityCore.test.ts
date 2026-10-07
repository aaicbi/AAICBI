import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANKING_CONFIG, badgesFor, computeVisibility, parseRankingConfig, pickFeatured, type OrgSignals,
} from "@/lib/ecosystem/visibilityCore";

const now = new Date("2026-10-07T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const good = (d: number, traineeId = "t1") => ({ publishedAt: daysAgo(d), hasDescription: true, skillCount: 2, linkedProgram: true, traineeId });
const base: OrgSignals = { posts: [], uniqueEngagers: 0, views: 0, followers: 0, certificatesIssued: 0, programCount: 0, programsWithSkills: 0, verified: false };

describe("computeVisibility", () => {
  it("is zero with nothing published", () => {
    expect(computeVisibility(base, DEFAULT_RANKING_CONFIG, now).score).toBe(0);
  });

  it("does not reward posting many videos in one week", () => {
    const few = { ...base, posts: [good(1), good(2)] };
    const flood = { ...base, posts: Array.from({ length: 40 }, (_, i) => good(i % 5)) };
    expect(computeVisibility(flood, DEFAULT_RANKING_CONFIG, now).score).toBe(computeVisibility(few, DEFAULT_RANKING_CONFIG, now).score);
  });

  it("rewards steady weeks over a single burst", () => {
    const steady = { ...base, posts: [1, 8, 15, 22, 29, 36].map((d) => good(d)) };
    const burst = { ...base, posts: [1, 1, 2, 2, 3, 3].map((d) => good(d)) };
    expect(computeVisibility(steady, DEFAULT_RANKING_CONFIG, now).score).toBeGreaterThan(computeVisibility(burst, DEFAULT_RANKING_CONFIG, now).score);
  });

  it("scores thin posts below complete ones", () => {
    const thin = { ...base, posts: [{ ...good(1), hasDescription: false, skillCount: 0, linkedProgram: false }] };
    expect(computeVisibility(thin, DEFAULT_RANKING_CONFIG, now).components.quality).toBe(0);
    expect(computeVisibility({ ...base, posts: [good(1)] }, DEFAULT_RANKING_CONFIG, now).components.quality).toBe(1);
  });

  it("ignores posts outside the window and stays within 0..100", () => {
    const old = { ...base, posts: [good(400)] };
    expect(computeVisibility(old, DEFAULT_RANKING_CONFIG, now).score).toBe(0);
    const max = { ...base, posts: [1, 8, 15, 22, 29, 36, 43, 50].map((d, i) => good(d, `t${i}`)), uniqueEngagers: 9999, views: 1e6, followers: 1e5, certificatesIssued: 1e4, programCount: 3, programsWithSkills: 3 };
    const r = computeVisibility(max, DEFAULT_RANKING_CONFIG, now).score;
    expect(r).toBeGreaterThan(90);
    expect(r).toBeLessThanOrEqual(100);
  });

  it("follows the weights", () => {
    const s = { ...base, posts: [good(1)], certificatesIssued: 50 };
    const none = { ...DEFAULT_RANKING_CONFIG, weights: { ...DEFAULT_RANKING_CONFIG.weights, achievements: 0 } };
    expect(computeVisibility(s, DEFAULT_RANKING_CONFIG, now).score).not.toBe(computeVisibility(s, none, now).score);
  });

  it("survives all-zero weights", () => {
    const zero = { ...DEFAULT_RANKING_CONFIG, weights: { quality: 0, engagement: 0, consistency: 0, participation: 0, achievements: 0, programs: 0 } };
    expect(computeVisibility({ ...base, posts: [good(1)] }, zero, now).score).toBe(0);
  });
});

describe("parseRankingConfig", () => {
  it("falls back to defaults for null or invalid input", () => {
    expect(parseRankingConfig(null)).toEqual(DEFAULT_RANKING_CONFIG);
    expect(parseRankingConfig({ weeklyPostCap: -3 })).toEqual(DEFAULT_RANKING_CONFIG);
  });
  it("keeps valid partial overrides", () => {
    const c = parseRankingConfig({ weeklyPostCap: 1, featured: { minScore: 10 } });
    expect(c.weeklyPostCap).toBe(1);
    expect(c.featured.minScore).toBe(10);
    expect(c.featured.maxFeatured).toBe(DEFAULT_RANKING_CONFIG.featured.maxFeatured);
  });
});

describe("badges and featured", () => {
  it("awards badges from behaviour, never from the raw score", () => {
    const s = { ...base, verified: true, posts: [1, 8, 15, 22, 29].map((d, i) => good(d, `t${i}`)) };
    const r = computeVisibility(s, DEFAULT_RANKING_CONFIG, now);
    expect(badgesFor(s, r, now)).toEqual(expect.arrayContaining(["verified", "consistent", "active", "trainees"]));
    expect(badgesFor(base, computeVisibility(base, DEFAULT_RANKING_CONFIG, now), now)).toEqual([]);
  });

  it("features only organizations meeting every criterion, best first, capped", () => {
    const cfg = { ...DEFAULT_RANKING_CONFIG, featured: { minScore: 40, minPublishedVideos: 3, maxFeatured: 2, requireVerified: true } };
    const orgs = [
      { id: "a", verified: true, publishedVideos: 5, score: 70 },
      { id: "b", verified: true, publishedVideos: 5, score: 90 },
      { id: "c", verified: false, publishedVideos: 9, score: 99 },
      { id: "d", verified: true, publishedVideos: 1, score: 95 },
      { id: "e", verified: true, publishedVideos: 5, score: 50 },
    ];
    expect(pickFeatured(orgs, cfg).map((o) => o.id)).toEqual(["b", "a"]);
    expect(pickFeatured(orgs, { ...cfg, featured: { ...cfg.featured, requireVerified: false } }).map((o) => o.id)).toEqual(["c", "b"]);
  });
});
