/**
 * Gaming Arena match rules, as pure functions (no database, no clock of their own).
 *
 * A match is a series of rounds. In each round one player picks a number, the server picks the question behind it
 * (so nobody can peek), and that player answers. If they miss (wrong, or out of time) the question goes to the other
 * player for 5 seconds, worth the normal points plus the bonus. If they miss too, the answer is shown to both.
 * Every step has a deadline kept by the server, and any request moves a match forward past deadlines that have
 * already passed, so the game never depends on a browser staying open.
 */
import { STEAL_SECONDS, bonusPoints, type ArenaRules } from "@/lib/arena/configCore";

export type ArenaFormat = "QUIZ" | "MATCHING" | "ORDERING" | "SCENARIO";
export type MatchStatus = "PENDING" | "LOBBY" | "ACTIVE" | "COMPLETED" | "DECLINED" | "EXPIRED" | "CANCELLED" | "FORFEITED";
export type Phase = "PICK" | "ANSWER" | "STEAL" | "REVEAL";

/** Normal points for answering a question of each kind. */
export const BASE_POINTS: Record<ArenaFormat, number> = { QUIZ: 80, MATCHING: 100, ORDERING: 120, SCENARIO: 100 };
/** The most a quick correct answer can add on top: a share of the question's points, so understanding beats clicking fast. */
export const SPEED_BONUS_SHARE = 0.2;
/** How long the result of a question stays on screen before the next turn. */
export const REVEAL_SECONDS = 6;
export const INVITE_MINUTES = 10;
export const LOBBY_MINUTES = 15;
/** An active match nobody has touched for this long is closed. */
export const ABANDON_MINUTES = 30;
/** Turns missed in a row before a player forfeits. */
export const FORFEIT_AFTER = 3;
/** How many numbers are on the board. */
export const boardSize = (rounds: number) => Math.max(20, rounds);

export const PICK_RATE = { messagesPer: 60_000, messages: 12, reactionsPer: 20_000, reactions: 10, challengesPer: 10 * 60_000, challenges: 6 };

/** Points for a correct first answer: the normal points plus a small bonus for speed. */
export function firstPoints(base: number, remainingMs: number, totalMs: number): number {
  const share = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  return base + Math.round(base * SPEED_BONUS_SHARE * share);
}

/** Points for answering a question the other player missed. No speed bonus: the bonus share replaces it. */
export const stealPoints = (base: number, bonusPercent: number) => bonusPoints(base, bonusPercent);

export const otherPlayer = (m: { challengerId: string; opponentId: string }, id: string) => (id === m.challengerId ? m.opponentId : m.challengerId);
export const isPlayer = (m: { challengerId: string; opponentId: string }, id: string) => id === m.challengerId || id === m.opponentId;

export function winnerOf(m: { challengerId: string; opponentId: string; scoreChallenger: number; scoreOpponent: number }): string | null {
  if (m.scoreChallenger === m.scoreOpponent) return null;
  return m.scoreChallenger > m.scoreOpponent ? m.challengerId : m.opponentId;
}

export interface Snapshot {
  status: MatchStatus;
  phase: Phase | null;
  phaseEndsAt: number | null;
  expiresAt: number;
  roundNo: number;
  rounds: number;
  paused: boolean;
  pausedAt: number | null;
  pauseMs: number;
  lastActivityAt: number;
}

export type DueAction =
  | { type: "EXPIRE" }
  | { type: "ABANDON" }
  | { type: "AUTO_RESUME" }
  | { type: "AUTO_PICK" }
  | { type: "FIRST_TIMEOUT" }
  | { type: "STEAL_TIMEOUT" }
  | { type: "NEXT" };

/** What, if anything, has fallen due. Called repeatedly until it returns null. */
export function dueAction(s: Snapshot, now: number): DueAction | null {
  if (s.status === "PENDING" || s.status === "LOBBY") return now >= s.expiresAt ? { type: "EXPIRE" } : null;
  if (s.status !== "ACTIVE") return null;
  if (now - s.lastActivityAt > ABANDON_MINUTES * 60_000 && !s.paused) return { type: "ABANDON" };
  if (s.paused) return s.pausedAt !== null && now - s.pausedAt >= s.pauseMs ? { type: "AUTO_RESUME" } : null;
  if (s.phaseEndsAt === null || now < s.phaseEndsAt) return null;
  switch (s.phase) {
    case "PICK": return { type: "AUTO_PICK" };
    case "ANSWER": return { type: "FIRST_TIMEOUT" };
    case "STEAL": return { type: "STEAL_TIMEOUT" };
    case "REVEAL": return { type: "NEXT" };
    default: return null;
  }
}

export function rulesFrom(raw: unknown): ArenaRules {
  const r = (raw ?? {}) as Partial<ArenaRules>;
  return {
    questionSeconds: r.questionSeconds ?? 60, pickSeconds: r.pickSeconds ?? 180, bonusPercent: r.bonusPercent ?? 50,
    pausesPerPlayer: r.pausesPerPlayer ?? 2, pauseSeconds: r.pauseSeconds ?? 60, questionsPerMatch: r.questionsPerMatch ?? 20, tickingSound: r.tickingSound ?? true,
  };
}

/** Reactions may only be sent between questions, never while someone is answering. */
export const reactionsOpen = (status: MatchStatus, phase: Phase | null, paused: boolean) =>
  (status === "LOBBY") || (status === "ACTIVE" && !paused && (phase === "PICK" || phase === "REVEAL")) || status === "COMPLETED";

export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  return t.length > 0 ? t : null;
}

export const STEAL_MS = STEAL_SECONDS * 1000;
