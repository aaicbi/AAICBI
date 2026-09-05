import { prisma } from "@/lib/prisma";
import { evaluateRateLimit, type BucketState, type RateLimitResult } from "@/lib/rateLimitCore";

/**
 * Rate limiting for the auth endpoints — the Postgres-backed storage
 * layer. The actual window-limiter algorithm lives in rateLimitCore.ts,
 * split out on purpose so it's testable without a live database
 * connection (see the comment at the top of that file for exactly why
 * that split exists — it wasn't the original design).
 *
 * Why Postgres and not an in-memory Map (which is what this originally
 * was): an in-memory counter only works correctly on a single,
 * persistent Node process. The README recommends Vercel, which runs
 * Next.js API routes as serverless functions — there's no guarantee two
 * requests land on the same instance, or that an instance stays warm
 * between them. An in-memory limiter on that deployment target could be
 * far weaker than it looks in local testing, possibly close to no real
 * limit at all. Postgres is already provisioned for everything else in
 * this app, so it's the lowest-new-dependency fix — no Redis, no new
 * service, no new env vars.
 *
 * Honest about what this doesn't fully solve: the read-then-write below
 * is wrapped in a transaction, which narrows but does not fully
 * eliminate a race where two requests for the same key arrive at almost
 * exactly the same instant — same category of residual risk as the
 * order-assignment race documented in the M10 course/module/lesson
 * creation routes, and an acceptable trade for the same reason: closing
 * it completely would mean reaching for SERIALIZABLE isolation or
 * row-level locking for a control where "occasionally one extra attempt
 * gets through under exact concurrent collision" is a vastly smaller
 * risk than "the limit doesn't apply at all," which is what this
 * replaces.
 */

export type { RateLimitResult };

// Opportunistic cleanup of expired buckets — runs with low probability
// on each call rather than a cron job (a poor fit for a serverless
// deployment target that may not stay warm), so the table doesn't grow
// unboundedly under sustained traffic without needing separate
// infrastructure to schedule it.
const CLEANUP_PROBABILITY = 0.01;
async function maybeCleanup() {
  if (Math.random() > CLEANUP_PROBABILITY) return;
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => {
    // Never let cleanup failure break the actual rate-limit check.
  });
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  void maybeCleanup(); // fire-and-forget, not on the request's critical path

  const now = Date.now();

  return prisma.$transaction(async (tx: any) => {
    const existing = await tx.rateLimitBucket.findUnique({ where: { id: key } });
    const bucket: BucketState | null = existing ? { count: existing.count, resetAt: existing.resetAt.getTime() } : null;

    const result = evaluateRateLimit(bucket, now, limit, windowMs);

    await tx.rateLimitBucket.upsert({
      where: { id: key },
      create: { id: key, count: result.nextBucket.count, resetAt: new Date(result.nextBucket.resetAt) },
      update: { count: result.nextBucket.count, resetAt: new Date(result.nextBucket.resetAt) },
    });

    return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
  });
}

/** Best-effort client IP extraction behind a proxy/load balancer. Falls
 * back to a constant so rate limiting still applies (conservatively,
 * shared across all unidentified clients) rather than silently
 * no-opping if the header is ever missing. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
