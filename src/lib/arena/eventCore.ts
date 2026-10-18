/** Ayakbi Arena live events: the knockout bracket, as pure functions (no database, no clock). */
export const NO_SHOW_MINUTES = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 64;

/** Size of the first round's bracket: the next power of two at or above the number of players. */
export const bracketSize = (n: number) => { let s = 2; while (s < n) s *= 2; return s; };
export const totalRoundsFor = (n: number) => Math.log2(bracketSize(n));

/**
 * The seed order of the slots in a bracket of `size`, so the strongest seeds meet as late as possible
 * (1 plays the weakest, 1 and 2 can only meet in the final). For 8: 1,8,4,5,2,7,3,6.
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const s of order) next.push(s, total - s);
    order = next;
  }
  return order;
}

export interface FirstRoundTie { slot: number; a: string | null; b: string | null; bye: boolean }

/** `playersBySeed[0]` is seed 1. Seeds beyond the number of players are byes, so the top seeds skip round one. */
export function firstRound(playersBySeed: string[]): FirstRoundTie[] {
  const size = bracketSize(playersBySeed.length);
  const order = seedOrder(size);
  const ties: FirstRoundTie[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = playersBySeed[order[i] - 1] ?? null;
    const b = playersBySeed[order[i + 1] - 1] ?? null;
    ties.push({ slot: i / 2, a, b, bye: !a || !b });
  }
  return ties;
}

/** Winners in slot order of one round pair up, neighbours first, for the next round. */
export function nextRound(winnersBySlot: (string | null)[]): { slot: number; a: string | null; b: string | null }[] {
  const out: { slot: number; a: string | null; b: string | null }[] = [];
  for (let i = 0; i < winnersBySlot.length; i += 2) out.push({ slot: i / 2, a: winnersBySlot[i] ?? null, b: winnersBySlot[i + 1] ?? null });
  return out;
}

export function roundName(round: number, totalRounds: number): string {
  const left = totalRounds - round;
  if (left === 0) return "Final";
  if (left === 1) return "Semi-finals";
  if (left === 2) return "Quarter-finals";
  return `Round of ${2 ** (left + 1)}`;
}

/** Who goes through when nobody tapped Ready in time: the better seed (the lower number). */
export function noShowWinner(a: { id: string; seed: number; ready: boolean }, b: { id: string; seed: number; ready: boolean }): string {
  if (a.ready !== b.ready) return a.ready ? a.id : b.id;
  return a.seed <= b.seed ? a.id : b.id;
}
