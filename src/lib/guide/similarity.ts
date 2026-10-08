import { tokens } from "@/lib/guide/text";

/**
 * Deciding that two differently worded questions are the same question.
 * "How do I message an employer?", "Where can I chat with an employer?" and
 * "How can I send a message to an employer?" all reduce to the same concept
 * words (message, employer), so they are one topic with a count, not three
 * rows. Pure word work, no service: the same code runs in tests and on the
 * server when a question is recorded.
 */

/** Sorted, de-duplicated concept words: equal keys mean the same meaning. */
export function tokenKeyOf(text: string): string {
  return [...new Set(tokens(text))].sort().join(" ");
}

function setOf(key: string): Set<string> {
  return new Set(key.split(" ").filter(Boolean));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const SAME_QUESTION_MIN = 0.7;

/** Whether two token keys mean the same thing: identical, or very close (one extra word at most). */
export function sameMeaning(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const a = setOf(keyA);
  const b = setOf(keyB);
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  if (small.size >= 2 && large.size - small.size <= 1 && [...small].every((t) => large.has(t))) return true;
  return jaccard(a, b) >= SAME_QUESTION_MIN;
}

export interface SimilarCandidate {
  id: string;
  tokenKey: string;
}

/** The best existing row a new question belongs with, or null when it is a new topic. */
export function findSimilar<T extends SimilarCandidate>(text: string, candidates: T[]): T | null {
  const key = tokenKeyOf(text);
  if (!key) return null;
  let best: { c: T; score: number } | null = null;
  for (const c of candidates) {
    if (!sameMeaning(key, c.tokenKey)) continue;
    const score = c.tokenKey === key ? 1 : jaccard(setOf(key), setOf(c.tokenKey));
    if (!best || score > best.score) best = { c, score };
  }
  return best ? best.c : null;
}

export const MAX_VARIANTS = 12;

/** Adds a wording to a row's list of variants: skipped when already there, oldest dropped when full. */
export function addVariant(variants: string[], text: string, primary: string): string[] {
  if (text === primary || variants.includes(text)) return variants;
  return [...variants, text].slice(-MAX_VARIANTS);
}
