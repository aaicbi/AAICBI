import { describe, it, expect } from "vitest";
import { evaluateRateLimit } from "@/lib/rateLimitCore";

/**
 * Tests for the pure window-limiter logic only — evaluateRateLimit
 * lives in its own zero-dependency file specifically so it can be
 * tested this way, without needing a live database connection. See the
 * comment at the top of rateLimitCore.ts for exactly why that split
 * exists (a real import-chain bug, caught by actually running these
 * tests, not a design that was right on the first attempt). The
 * Postgres-backed wrapper (rateLimit() in rateLimit.ts) isn't covered
 * here since this sandbox can't run `prisma generate` (see README) to
 * get a real, typed client to test against; that's real, disclosed
 * test-coverage debt, not something quietly skipped — an integration
 * test against a live database is the right next step for covering the
 * storage layer once one is available to test against.
 */
describe("evaluateRateLimit", () => {
  const LIMIT = 5;
  const WINDOW_MS = 15 * 60 * 1000;

  it("allows the first request with no prior bucket", () => {
    const result = evaluateRateLimit(null, 1000, LIMIT, WINDOW_MS);
    expect(result.allowed).toBe(true);
    expect(result.nextBucket).toEqual({ count: 1, resetAt: 1000 + WINDOW_MS });
  });

  it("allows requests under the limit, incrementing count each time", () => {
    let bucket = { count: 1, resetAt: 1000 + WINDOW_MS };
    for (let i = 2; i <= LIMIT; i++) {
      const result = evaluateRateLimit(bucket, 1000, LIMIT, WINDOW_MS);
      expect(result.allowed).toBe(true);
      expect(result.nextBucket.count).toBe(i);
      bucket = result.nextBucket;
    }
  });

  it("blocks the request exactly at the limit", () => {
    const bucket = { count: LIMIT, resetAt: 1000 + WINDOW_MS };
    const result = evaluateRateLimit(bucket, 1000, LIMIT, WINDOW_MS);
    expect(result.allowed).toBe(false);
  });

  it("reports a correct, positive retryAfterSeconds when blocked", () => {
    const bucket = { count: LIMIT, resetAt: 1000 + 30_000 }; // resets in 30s
    const result = evaluateRateLimit(bucket, 1000, LIMIT, WINDOW_MS);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it("resets and allows again once the window has passed", () => {
    const bucket = { count: LIMIT, resetAt: 1000 };
    const result = evaluateRateLimit(bucket, 1001, LIMIT, WINDOW_MS); // now is after resetAt
    expect(result.allowed).toBe(true);
    expect(result.nextBucket).toEqual({ count: 1, resetAt: 1001 + WINDOW_MS });
  });

  it("does not mutate the bucket it was given when blocking", () => {
    const bucket = { count: LIMIT, resetAt: 1000 + WINDOW_MS };
    const originalCount = bucket.count;
    evaluateRateLimit(bucket, 1000, LIMIT, WINDOW_MS);
    expect(bucket.count).toBe(originalCount); // caller's object untouched
  });
});
