/**
 * The pure, zero-dependency half of examEngine.ts — same split
 * rationale as rateLimitCore.ts and embeddingsCore.ts: examEngine.ts
 * imports `prisma` at module scope, which eagerly instantiates
 * `new PrismaClient()` and (in this sandbox, per the README's "Note on
 * prisma generate") crashes on import wherever `prisma generate`
 * couldn't reach `binaries.prisma.sh`. Logic that doesn't actually need
 * Prisma shouldn't have to drag that in just to be testable.
 *
 * Generic over `T extends { id: string }` rather than importing
 * Prisma's `Question`/`Option` types directly — this keeps the file
 * genuinely zero-dependency instead of just moving the same
 * type-import problem one file over.
 */

/**
 * Rebuilds an ordered list from a stored `questionOrder` JSON value (an
 * array of ids) plus the full pool it was drawn from — used when
 * resuming an in-progress attempt (see examEngine.ts's startAttempt)
 * instead of drawing a fresh random sample, so a resumed attempt shows
 * the exact same questions in the exact same order it started with.
 *
 * Deliberately tolerant of a malformed/missing `questionOrder`: returns
 * an empty array rather than throwing, since `questionOrder` is a
 * `Json?` column with no schema-level guarantee about its shape, and a
 * bad value here should degrade to "show nothing" for this attempt,
 * never crash the request.
 */
export function reconstructOrderedItems<T extends { id: string }>(pool: T[], order: unknown): T[] {
  const ids = Array.isArray(order) ? (order as unknown[]) : [];
  const byId = new Map(pool.map((item) => [item.id, item]));
  const result: T[] = [];
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const item = byId.get(id);
    if (item) result.push(item);
  }
  return result;
}
