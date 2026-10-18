/**
 * Ayakbi Arena: the champion ladder, as pure functions (no database, no clock of their own).
 * Ratings are Elo: everyone starts at 1000, a win over a stronger player is worth more, and no match moves a player by more than K.
 */
export const START_RATING = 1000;
export const K_FACTOR = 32;
/** Matches a player needs before they appear on the ladder. */
export const MIN_MATCHES = 5;
/** Matches against the same opponent that count in one day. */
export const SAME_PAIR_DAILY_LIMIT = 3;
/** Fewest counted matches in a week to be crowned that week's champion. */
export const CHAMPION_MIN_MATCHES = 3;

export type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "CHAMPION";
export const TIERS: { tier: Tier; label: string; from: number }[] = [
  { tier: "BRONZE", label: "Bronze", from: 0 },
  { tier: "SILVER", label: "Silver", from: 1000 },
  { tier: "GOLD", label: "Gold", from: 1200 },
  { tier: "PLATINUM", label: "Platinum", from: 1400 },
  { tier: "CHAMPION", label: "Champion", from: 1600 },
];

export function tierOf(rating: number) {
  let t = TIERS[0];
  for (const x of TIERS) if (rating >= x.from) t = x;
  return t;
}

/** Where a rating sits in its tier: points to the next tier and how far along (0 to 1). Null at the top. */
export function progressToNext(rating: number): { next: string; toNext: number; fraction: number } | null {
  const i = TIERS.findIndex((t) => t.tier === tierOf(rating).tier);
  const next = TIERS[i + 1];
  if (!next) return null;
  const from = TIERS[i].from;
  return { next: next.label, toNext: next.from - rating, fraction: Math.min(1, Math.max(0, (rating - from) / (next.from - from))) };
}

export const expectedScore = (mine: number, theirs: number) => 1 / (1 + Math.pow(10, (theirs - mine) / 400));

/** `score` is 1 for a win, 0.5 for a draw, 0 for a loss. Returns the whole-number change for the first player. */
export function ratingDelta(mine: number, theirs: number, score: 0 | 0.5 | 1, k = K_FACTOR): number {
  return Math.round(k * (score - expectedScore(mine, theirs)));
}

/** Monday 00:00 UTC of the week a moment falls in. */
export function weekStart(t: number | Date): Date {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

export function monthStart(t: number | Date): Date {
  const d = new Date(t);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export type Period = "week" | "month" | "all";
export const periodStart = (p: Period, now: number): Date | null => (p === "week" ? weekStart(now) : p === "month" ? monthStart(now) : null);
