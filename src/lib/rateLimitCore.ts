/**
 * The pure window-limiter algorithm, deliberately kept in its own file
 * with zero imports — not even from src/lib/prisma. This split exists
 * because of a real bug caught while actually running the tests, not a
 * design I got right on the first try: evaluateRateLimit was originally
 * defined in the same file as the Postgres-backed rateLimit() wrapper,
 * which imports `prisma` at module scope. Since src/lib/prisma.ts
 * eagerly instantiates `new PrismaClient()` on import, and this sandbox
 * can't run `prisma generate` (see README), importing evaluateRateLimit
 * for a test ALSO pulled in the broken Prisma client and crashed the
 * test file before a single assertion ran — even though the pure
 * function itself never touches Prisma. Splitting the file is the fix;
 * see rateLimit.ts for the Postgres-backed wrapper that actually uses
 * this in production.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface BucketState {
  count: number;
  resetAt: number; // epoch ms
}

/** Given the current bucket state (or none) and now, decide whether
 * this request is allowed and what the bucket should become next. */
export function evaluateRateLimit(
  bucket: BucketState | null,
  now: number,
  limit: number,
  windowMs: number
): RateLimitResult & { nextBucket: BucketState } {
  if (!bucket || now > bucket.resetAt) {
    return { allowed: true, nextBucket: { count: 1, resetAt: now + windowMs } };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      nextBucket: bucket,
    };
  }

  return { allowed: true, nextBucket: { count: bucket.count + 1, resetAt: bucket.resetAt } };
}
