/**
 * The pure duplicate-detection math, deliberately kept in its own file
 * with zero imports — same reasoning as rateLimitCore.ts (see that
 * file's own comment): embeddings.ts imports `prisma` at module scope
 * for the pgvector raw-SQL lookup, and prisma.ts eagerly instantiates
 * `new PrismaClient()` on import. Importing this logic for a test
 * should not also pull in a Prisma client this sandbox can't generate
 * (see README's "Note on prisma generate"). Nothing below touches
 * Prisma, the network, or an API key — it's just arithmetic on numbers
 * someone else already computed.
 */

/**
 * Cosine similarity between two equal-length embedding vectors, in
 * [-1, 1] (in practice close to [0, 1] for text embeddings, since
 * embedding models rarely produce near-opposite vectors for any two
 * real questions). 1 = identical direction, 0 = unrelated.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Cannot compare embeddings of different lengths (${a.length} vs ${b.length}). ` +
        `This should never happen in practice — it would mean two embeddings came from different model configurations.`
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * The duplicate-flagging threshold itself — a judgment call, not a
 * fully "solved" number, exactly like the trainee session-length
 * constant in session.ts. 0.93 is a deliberately conservative starting
 * point for short multiple-choice question text: high enough that two
 * genuinely different questions on the same topic (e.g. two separate
 * Excel VLOOKUP questions) shouldn't often cross it, low enough to
 * catch an instructor re-uploading a near-identical question with
 * light rewording. Revisit this once a real bank has grown large
 * enough to show false positives or misses — there's no way to derive
 * the "correct" number without that real usage data.
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.93;

export function isDuplicateMatch(similarity: number): boolean {
  return similarity >= DUPLICATE_SIMILARITY_THRESHOLD;
}

/** Given a new question's similarity score against every existing
 * question in the bank, find the closest match (if any crosses the
 * threshold). Returns null if the bank is empty or nothing is close
 * enough to flag. */
export function findClosestDuplicate<T>(
  candidates: { item: T; similarity: number }[]
): { item: T; similarity: number } | null {
  let best: { item: T; similarity: number } | null = null;
  for (const c of candidates) {
    if (!isDuplicateMatch(c.similarity)) continue;
    if (!best || c.similarity > best.similarity) best = c;
  }
  return best;
}
