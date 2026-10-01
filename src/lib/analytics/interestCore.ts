/**
 * Analytics System Phase 3 — the Interest Intelligence engine's pure
 * math, deliberately separated from the Prisma orchestration in
 * interestScoring.ts (same testability reasoning as every other
 * `*Core.ts` file in this project — see examEngineCore.ts, this
 * codebase's own established pattern).
 */

/**
 * Exponential half-life decay — a signal from `halfLifeDays` ago counts
 * for half its original weight, one from `2 × halfLifeDays` ago counts
 * for a quarter, and so on. No hard cutoff: old activity never drops to
 * exactly zero, it just fades, matching the master spec's own Section
 * 30 instruction ("recent activity = stronger signal... prevents
 * outdated behaviour from permanently defining a user's interests").
 */
export function computeDecayedWeight(rawWeight: number, daysAgo: number, halfLifeDays: number): number {
  if (daysAgo <= 0) return rawWeight;
  return rawWeight * Math.pow(0.5, daysAgo / halfLifeDays);
}

/**
 * Turns an unbounded, accumulated weighted score into an explainable
 * 0-100 "confidence" that climbs toward 100% as evidence piles up
 * (the underlying curve is asymptotic and mathematically never reaches
 * it; the rounded integer can display as 100 only for a score far
 * beyond what this engine's own weights could realistically produce).
 * Deliberately NOT a raw score relabeled as a percentage (which could
 * exceed 100 and mean nothing to a reader) and NOT normalized against
 * another topic's score (which would make "Cybersecurity: 87%" a
 * statement about this trainee's OTHER interests, not about the
 * evidence for Cybersecurity itself).
 */
export function computeConfidencePercent(totalWeightedScore: number, saturationConstant: number): number {
  if (totalWeightedScore <= 0) return 0;
  return Math.round(100 * (1 - Math.exp(-totalWeightedScore / saturationConstant)));
}

export interface TopicScore {
  topic: string;
  confidencePercent: number;
  // True when EVERY signal behind this topic's score falls inside the
  // "emerging" window — see classifyInterests below for why this is
  // computed by the caller (interestScoring.ts has the actual event
  // timestamps; this file stays pure).
  allEvidenceRecent: boolean;
}

export interface InterestClassification {
  primary: string | null;
  secondary: string[];
  emerging: string[];
}

// Same floor for both — a topic needs real evidence behind it to be
// labeled a primary OR secondary interest at all. Audit finding, fixed
// before shipping: without a floor on primary specifically, a single
// weak signal (one course view, ~5% confidence) was being reported as
// "Primary Interest" purely for being the only topic with any score at
// all — exactly the overclaiming the master spec's own distinction
// between "observed behaviour" and "inferred interest" warns against.
// A topic below this floor can still surface as "emerging" (below) if
// its evidence is recent — that's the honest label for "not enough yet
// to call an interest."
const MIN_CONFIDENCE_TO_CLAIM = 15;
const MAX_SECONDARY = 2;

/**
 * Ranks a trainee's topic scores into primary/secondary/emerging —
 * see the master spec's own Section 9 example shape ("Primary Interest:
 * AI Engineering. Secondary Interests: Data Science, Automation.
 * Emerging Interest: Cybersecurity"). A topic is "emerging" only when
 * ALL its evidence is recent AND it didn't already make
 * primary/secondary on its own merits — i.e., a newly-appearing
 * interest that hasn't had time to accumulate a high score yet, not a
 * relabeling of an already-strong one.
 */
export function classifyInterests(topicScores: TopicScore[]): InterestClassification {
  const ranked = [...topicScores].filter((t) => t.confidencePercent > 0).sort((a, b) => b.confidencePercent - a.confidencePercent);

  const top = ranked[0];
  const primary = top && top.confidencePercent >= MIN_CONFIDENCE_TO_CLAIM ? top.topic : null;

  const secondary = ranked
    .filter((t) => t.topic !== primary && t.confidencePercent >= MIN_CONFIDENCE_TO_CLAIM)
    .slice(0, MAX_SECONDARY)
    .map((t) => t.topic);

  const claimed = new Set([primary, ...secondary].filter((t): t is string => t !== null));
  const emerging = ranked.filter((t) => t.allEvidenceRecent && !claimed.has(t.topic)).map((t) => t.topic);

  return { primary, secondary, emerging };
}
