/**
 * Ayakbi Arena: the match, kept by the server.
 *
 * Every request loads the match, moves it past any deadline that has already passed (a player who ran out of time,
 * a pause that ran too long, an invitation nobody answered), applies what the player asked for if the rules allow it, and saves
 * with a version check so two requests at once cannot both win. Browsers never decide anything: they send what a player
 * did and fetch what they may see (see arenaView.ts).
 */
import type { ArenaMatch, ArenaRound } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { availabilityForCourse, resolveForCourse } from "@/lib/arena/config";
import { RULE_LIMITS, type ArenaRules } from "@/lib/arena/configCore";
import {
  FORFEIT_AFTER, INVITE_MINUTES, LOBBY_MINUTES, REVEAL_SECONDS, STEAL_MS, boardSize, cleanMessage, dueAction, firstPoints, isPlayer, otherPlayer,
  reactionsOpen, rulesFrom, stealPoints, winnerOf, type DueAction, type Phase, type Snapshot,
} from "@/lib/arena/arenaCore";
import { basePointsFor, chooseEntry, gradeEntry, poolFor, revealEntry, serveEntry, type PoolEntry } from "@/lib/arena/arenaPool";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";
import { activeSuspension, suspensionText } from "@/lib/arena/suspension";

export class ArenaError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const REACTION_KINDS = ["applause", "cheer", "wow", "fire", "love", "strong", "nervous", "sad", "laugh", "thumbs", "gg", "think"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

interface Draft {
  m: ArenaMatch;
  rounds: ArenaRound[];
  /** Indexes into `rounds` that changed, and rounds created during this request. */
  dirty: Set<number>;
  created: ArenaRound[];
}

const ms = (d: Date | null) => (d ? d.getTime() : null);

function snapshotOf(d: Draft): Snapshot {
  const rules = rulesFrom(d.m.rules);
  return {
    status: d.m.status, phase: d.m.phase, phaseEndsAt: ms(d.m.phaseEndsAt), expiresAt: d.m.expiresAt.getTime(), roundNo: d.m.roundNo, rounds: rules.questionsPerMatch,
    paused: d.m.pausedById !== null, pausedAt: ms(d.m.pausedAt), pauseMs: rules.pauseSeconds * 1000, lastActivityAt: d.m.lastActivityAt.getTime(),
  };
}

const currentRound = (d: Draft): ArenaRound | null => (d.rounds.length ? d.rounds[d.rounds.length - 1] : null);
const markDirty = (d: Draft, r: ArenaRound) => { const i = d.rounds.indexOf(r); if (i >= 0) d.dirty.add(i); };
const isChallenger = (m: ArenaMatch, id: string) => id === m.challengerId;

function bump(d: Draft, who: string, kind: "miss" | "ok") {
  const key = isChallenger(d.m, who) ? "missChallenger" : "missOpponent";
  d.m[key] = kind === "ok" ? 0 : d.m[key] + 1;
}

function finish(d: Draft, at: number, status: "COMPLETED" | "FORFEITED" | "CANCELLED", reason: string, winnerId?: string | null) {
  d.m.status = status;
  d.m.phase = null;
  d.m.phaseEndsAt = null;
  d.m.pausedById = null;
  d.m.pausedAt = null;
  d.m.pauseRemainingMs = null;
  d.m.endedAt = new Date(at);
  d.m.endReason = reason;
  d.m.winnerId = winnerId === undefined ? winnerOf(d.m) : winnerId;
}

function forfeitIfMissedTooMany(d: Draft, who: string, at: number): boolean {
  const misses = isChallenger(d.m, who) ? d.m.missChallenger : d.m.missOpponent;
  if (misses >= FORFEIT_AFTER) { finish(d, at, "FORFEITED", "forfeit", otherPlayer(d.m, who)); return true; }
  return false;
}

async function usedEntries(d: Draft): Promise<{ now: Set<string>; before: Set<string> }> {
  const now = new Set(d.rounds.map((r) => r.itemId));
  const before = new Set<string>();
  // A rematch avoids the previous match's questions while there are fresh ones.
  if (d.m.rematchOfId) for (const r of await prisma.arenaRound.findMany({ where: { matchId: d.m.rematchOfId }, select: { itemId: true } })) before.add(r.itemId);
  return { now, before };
}

/** Creates the round for a number: the server picks the question behind it. */
async function startRound(d: Draft, pickerId: string, number: number, at: number): Promise<void> {
  const rules = rulesFrom(d.m.rules);
  const pool = await poolFor(d.m.courseId, d.m.moduleId);
  const used = await usedEntries(d);
  const skip = new Set<string>();
  let entry: PoolEntry | null = null;
  let served: Awaited<ReturnType<typeof serveEntry>> = null;
  // A broken item is skipped, not allowed to end the match.
  for (let tries = 0; tries < 8 && !served; tries++) {
    const taken = new Set([...used.now, ...skip]);
    entry = chooseEntry(pool, new Set([...taken, ...used.before])) ?? chooseEntry(pool, taken);
    if (!entry) break;
    served = await serveEntry(entry);
    if (!served) skip.add(entry.id);
  }
  if (!entry || !served) { finish(d, at, "COMPLETED", "no-more-questions"); return; }
  const round = {
    id: `pending-${d.rounds.length}`, matchId: d.m.id, idx: d.rounds.length, pickerId, number, format: entry.format, itemKind: entry.kind, itemId: entry.id,
    basePoints: basePointsFor(entry), served: served as unknown as object, servedAt: new Date(at),
    firstResponse: null, firstCorrect: null, firstTimedOut: false, firstAt: null, stealerId: null, stealResponse: null, stealCorrect: null, stealTimedOut: false, stealAt: null,
    outcome: null, awardedToId: null, points: 0, reveal: null,
  } as unknown as ArenaRound;
  d.rounds.push(round);
  d.created.push(round);
  d.m.roundNo += 1;
  d.m.phase = "ANSWER";
  d.m.phaseEndsAt = new Date(at + rules.questionSeconds * 1000);
}

function entryOf(r: ArenaRound): PoolEntry {
  return { kind: r.itemKind as PoolEntry["kind"], id: r.itemId, format: r.format as PoolEntry["format"] };
}

async function endRound(d: Draft, at: number, outcome: "FIRST" | "STOLEN" | "NONE", awardedToId: string | null, points: number): Promise<void> {
  const r = currentRound(d)!;
  r.outcome = outcome;
  r.awardedToId = awardedToId;
  r.points = points;
  r.reveal = (await revealEntry(entryOf(r))) as unknown as object;
  markDirty(d, r);
  if (awardedToId) { if (isChallenger(d.m, awardedToId)) d.m.scoreChallenger += points; else d.m.scoreOpponent += points; }
  d.m.phase = "REVEAL";
  d.m.phaseEndsAt = new Date(at + REVEAL_SECONDS * 1000);
}

function toSteal(d: Draft, at: number): void {
  const r = currentRound(d)!;
  r.stealerId = otherPlayer(d.m, r.pickerId);
  markDirty(d, r);
  d.m.phase = "STEAL";
  d.m.phaseEndsAt = new Date(at + STEAL_MS);
}

function nextTurn(d: Draft, at: number): void {
  const rules = rulesFrom(d.m.rules);
  d.m.turnId = otherPlayer(d.m, d.m.turnId ?? d.m.challengerId);
  d.m.phase = "PICK";
  d.m.phaseEndsAt = new Date(at + rules.pickSeconds * 1000);
}

function usedNumbers(d: Draft) { return new Set(d.rounds.map((r) => r.number)); }

function randomFreeNumber(d: Draft): number {
  const size = boardSize(rulesFrom(d.m.rules).questionsPerMatch);
  const used = usedNumbers(d);
  const free: number[] = [];
  for (let n = 1; n <= size; n++) if (!used.has(n)) free.push(n);
  return free[Math.floor(Math.random() * free.length)];
}

async function applyDue(d: Draft, a: DueAction): Promise<void> {
  const rules = rulesFrom(d.m.rules);
  const at = d.m.phaseEndsAt?.getTime() ?? Date.now();
  switch (a.type) {
    case "EXPIRE":
      d.m.status = "EXPIRED"; d.m.endedAt = new Date(d.m.expiresAt); d.m.endReason = "expired"; return;
    case "ABANDON":
      finish(d, Date.now(), "FORFEITED", "abandoned"); return;
    case "AUTO_RESUME": {
      const pausedAt = d.m.pausedAt!.getTime();
      const resumeAt = pausedAt + rules.pauseSeconds * 1000;
      d.m.phaseEndsAt = new Date(resumeAt + (d.m.pauseRemainingMs ?? 0));
      d.m.pausedById = null; d.m.pausedAt = null; d.m.pauseRemainingMs = null; d.m.lastActivityAt = new Date(resumeAt);
      return;
    }
    case "AUTO_PICK": {
      const who = d.m.turnId!;
      bump(d, who, "miss");
      if (forfeitIfMissedTooMany(d, who, at)) return;
      await startRound(d, who, randomFreeNumber(d), at);
      return;
    }
    case "FIRST_TIMEOUT": {
      const r = currentRound(d)!;
      r.firstTimedOut = true; markDirty(d, r);
      bump(d, r.pickerId, "miss");
      if (forfeitIfMissedTooMany(d, r.pickerId, at)) return;
      toSteal(d, at);
      return;
    }
    case "STEAL_TIMEOUT": {
      const r = currentRound(d)!;
      r.stealTimedOut = true; markDirty(d, r);
      await endRound(d, at, "NONE", null, 0);
      return;
    }
    case "NEXT":
      if (d.m.roundNo >= rules.questionsPerMatch) finish(d, at, "COMPLETED", "complete");
      else nextTurn(d, at);
      return;
  }
}

async function advance(d: Draft, now: number): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const a = dueAction(snapshotOf(d), now);
    if (!a) return;
    await applyDue(d, a);
  }
}

const FIELDS = [
  "status", "expiresAt", "readyChallenger", "readyOpponent", "phase", "phaseEndsAt", "roundNo", "turnId", "scoreChallenger", "scoreOpponent", "missChallenger", "missOpponent",
  "pausedById", "pausedAt", "pauseRemainingMs", "pausesUsedChallenger", "pausesUsedOpponent", "winnerId", "endReason", "startedAt", "endedAt", "lastActivityAt",
] as const;

const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);

class Conflict extends Error {}

export interface MutateResult<T> { match: ArenaMatch; rounds: ArenaRound[]; value: T }

/**
 * Loads a match, moves it forward past due deadlines, runs `fn` (the player's action, if any), and saves.
 * If `fn` refuses, whatever time-based progress was made is still saved before the refusal is returned.
 */
export async function mutate<T>(matchId: string, fn?: (d: Draft, now: number) => Promise<T> | T): Promise<MutateResult<T | undefined>> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await prisma.arenaMatch.findUnique({ where: { id: matchId }, include: { rounds: { orderBy: { idx: "asc" } } } });
    if (!row) throw new ArenaError("That match could not be found.", 404);
    const { rounds, ...m } = row;
    const d: Draft = { m: { ...m }, rounds: rounds.map((r) => ({ ...r })), dirty: new Set(), created: [] };
    const now = Date.now();
    const before = { ...m };
    let value: T | undefined;
    let refusal: ArenaError | null = null;
    await advance(d, now);
    if (fn) {
      try { value = await fn(d, now); } catch (e) { if (e instanceof ArenaError) refusal = e; else throw e; }
    }
    const changed = FIELDS.some((k) => !same(before[k], d.m[k])) || d.dirty.size > 0 || d.created.length > 0;
    if (changed) {
      try {
        await prisma.$transaction(async (tx) => {
          const data: Record<string, unknown> = {};
          for (const k of FIELDS) if (!same(before[k], d.m[k])) data[k] = d.m[k];
          const res = await tx.arenaMatch.updateMany({ where: { id: matchId, version: before.version }, data: { ...data, version: { increment: 1 } } as never });
          if (res.count === 0) throw new Conflict();
          for (const i of Array.from(d.dirty)) {
            const r = d.rounds[i];
            if (d.created.includes(r)) continue;
            await tx.arenaRound.update({ where: { id: r.id }, data: { firstResponse: r.firstResponse as never, firstCorrect: r.firstCorrect, firstTimedOut: r.firstTimedOut, firstAt: r.firstAt, stealerId: r.stealerId, stealResponse: r.stealResponse as never, stealCorrect: r.stealCorrect, stealTimedOut: r.stealTimedOut, stealAt: r.stealAt, outcome: r.outcome, awardedToId: r.awardedToId, points: r.points, reveal: r.reveal as never } });
          }
          for (const r of d.created) {
            const { id: _drop, ...rest } = r as unknown as Record<string, unknown>;
            void _drop;
            await tx.arenaRound.create({ data: { ...rest, served: r.served as never } as never });
          }
        });
      } catch (e) {
        if (e instanceof Conflict) continue;
        throw e;
      }
      d.m.version = before.version + 1;
      void pokeMatch(d.m);
    }
    if (refusal) throw refusal;
    return { match: d.m, rounds: d.rounds, value };
  }
  throw new ArenaError("The match changed while you were acting. Try again.", 409);
}

async function pokeMatch(m: ArenaMatch, kind?: string) {
  await pokeMany([
    { channel: channels.match(m.id), message: { v: m.version, k: kind } },
    { channel: channels.user(m.challengerId), message: { v: m.version, k: kind ?? "match" } },
    { channel: channels.user(m.opponentId), message: { v: m.version, k: kind ?? "match" } },
  ]);
}

/* ------------------------------------------------------------------ */
/* Challenges and the lobby                                           */
/* ------------------------------------------------------------------ */

export const ONLINE_SECONDS = 60;

export async function isEnrolled(traineeId: string, courseId: string): Promise<boolean> {
  return !!(await prisma.courseEnrollment.findFirst({ where: { traineeId, courseId, unlockedAt: { not: null }, accessRevokedAt: null }, select: { id: true } }));
}

export async function requireArena(traineeId: string, courseId: string): Promise<ArenaRules> {
  const avail = await availabilityForCourse(courseId);
  if (!avail.game) throw new ArenaError("The Ayakbi Arena isn't open for this course right now.", 403);
  if (!(await isEnrolled(traineeId, courseId))) throw new ArenaError("You can play in the arenas of courses you are enrolled in.", 403);
  return rulesFrom(await resolveForCourse(courseId));
}

export async function activeMatchOf(traineeId: string) {
  return prisma.arenaMatch.findFirst({ where: { status: { in: ["PENDING", "LOBBY", "ACTIVE"] }, OR: [{ challengerId: traineeId }, { opponentId: traineeId }] }, orderBy: { createdAt: "desc" } });
}

export async function touchPresence(traineeId: string, courseId: string): Promise<void> {
  const before = await prisma.arenaPresence.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { lastSeenAt: true } });
  await prisma.arenaPresence.upsert({ where: { traineeId_courseId: { traineeId, courseId } }, create: { traineeId, courseId }, update: { lastSeenAt: new Date() } });
  // Someone who just arrived appears on everyone else's list at once, not at their next check.
  if (!before || Date.now() - before.lastSeenAt.getTime() > ONLINE_SECONDS * 1000) void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "lobby" } }]);
}

const lastTouch = new Map<string, number>();
/** Match screens keep a player "in the arena" (shown as busy) without a database write on every refresh. */
export async function touchPresenceSoon(traineeId: string, courseId: string): Promise<void> {
  const key = `${traineeId}:${courseId}`;
  const now = Date.now();
  if (now - (lastTouch.get(key) ?? 0) < 20_000) return;
  lastTouch.set(key, now);
  await touchPresence(traineeId, courseId);
}

/** Someone leaves the arena page: they drop off the others' lists straight away. */
export async function clearPresence(traineeId: string, courseId: string): Promise<void> {
  await prisma.arenaPresence.deleteMany({ where: { traineeId, courseId } });
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "lobby" } }]);
}

export async function createChallenge(input: { challengerId: string; opponentId: string; courseId: string; moduleId?: string | null; rematchOfId?: string | null }) {
  const { challengerId, opponentId, courseId } = input;
  if (challengerId === opponentId) throw new ArenaError("Choose a coursemate to challenge.");
  const rules = await requireArena(challengerId, courseId);
  const mine = await activeSuspension(challengerId, courseId);
  if (mine) throw new ArenaError(suspensionText(mine), 403);
  if (await activeSuspension(opponentId, courseId)) throw new ArenaError("That person can't play in this arena right now.", 409);
  if (!(await isEnrolled(opponentId, courseId))) throw new ArenaError("That person isn't in this course's arena.", 404);
  // A rematch goes to someone who has just been playing, so the "online in the arena" check is only for fresh challenges.
  if (!input.rematchOfId) {
    const presence = await prisma.arenaPresence.findUnique({ where: { traineeId_courseId: { traineeId: opponentId, courseId } } });
    if (!presence || Date.now() - presence.lastSeenAt.getTime() > ONLINE_SECONDS * 1000) throw new ArenaError("That person isn't online in the arena right now.");
  }
  if (await activeMatchOf(challengerId)) throw new ArenaError("Finish or leave your current match before starting another.", 409);
  if (await activeMatchOf(opponentId)) throw new ArenaError("That person is busy in another match.", 409);
  let moduleId: string | null = input.moduleId ?? null;
  if (moduleId) {
    const mod = await prisma.module.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
    if (!mod) throw new ArenaError("That topic isn't part of this course.", 404);
  } else moduleId = null;
  const pool = await poolFor(courseId, moduleId);
  // A match is as long as the instructor's rule, or as many questions as the course has when that is fewer (never below 4).
  if (pool.length < RULE_LIMITS.questionsPerMatch.min) throw new ArenaError(`This ${moduleId ? "topic" : "course"} doesn't have enough approved questions to play yet (it needs at least ${RULE_LIMITS.questionsPerMatch.min}).`, 409);
  const length = Math.min(rules.questionsPerMatch, pool.length);
  const m = await prisma.arenaMatch.create({
    data: { courseId, moduleId, challengerId, opponentId, rematchOfId: input.rematchOfId ?? null, rules: { ...rules, questionsPerMatch: length } as never, expiresAt: new Date(Date.now() + INVITE_MINUTES * 60_000) },
  });
  void pokeMany([{ channel: channels.user(opponentId), message: { v: m.version, k: "challenge" } }, { channel: channels.course(courseId), message: { v: 0, k: "lobby" } }]);
  return m;
}

function requirePlayer(d: Draft, id: string) {
  if (!isPlayer(d.m, id)) throw new ArenaError("That match could not be found.", 404);
}

export async function respondToChallenge(matchId: string, traineeId: string, accept: boolean) {
  if (accept) {
    const m = await prisma.arenaMatch.findUnique({ where: { id: matchId }, select: { courseId: true } });
    const s = m ? await activeSuspension(traineeId, m.courseId) : null;
    if (s) throw new ArenaError(suspensionText(s), 403);
  }
  return mutate(matchId, (d, now) => {
    requirePlayer(d, traineeId);
    if (d.m.opponentId !== traineeId) throw new ArenaError("Only the player who was challenged can answer.", 403);
    if (d.m.status !== "PENDING") throw new ArenaError(d.m.status === "EXPIRED" ? "That challenge has expired." : "That challenge was already answered.", 409);
    if (accept) { d.m.status = "LOBBY"; d.m.expiresAt = new Date(now + LOBBY_MINUTES * 60_000); }
    else { d.m.status = "DECLINED"; d.m.endedAt = new Date(now); d.m.endReason = "declined"; }
    d.m.lastActivityAt = new Date(now);
  });
}

export async function leaveMatch(matchId: string, traineeId: string) {
  const res = await mutate(matchId, (d, now) => {
    requirePlayer(d, traineeId);
    if (d.m.status === "PENDING" || d.m.status === "LOBBY") {
      d.m.status = "CANCELLED"; d.m.endedAt = new Date(now); d.m.endReason = "cancelled"; return;
    }
    if (d.m.status !== "ACTIVE") throw new ArenaError("That match is already over.", 409);
    finish(d, now, "FORFEITED", "left", otherPlayer(d.m, traineeId));
  });
  // Quitting an active game is never silent: the other player gets a plain message and the win.
  if (res.match.status === "FORFEITED" && res.match.endReason === "left") {
    await prisma.arenaMessage.create({ data: { matchId, senderId: traineeId, body: "I quit the game. You win!" } });
  }
  return res;
}

export async function setReady(matchId: string, traineeId: string, ready: boolean) {
  return mutate(matchId, (d, now) => {
    requirePlayer(d, traineeId);
    if (d.m.status !== "LOBBY") throw new ArenaError("The lobby isn't open.", 409);
    if (isChallenger(d.m, traineeId)) d.m.readyChallenger = ready; else d.m.readyOpponent = ready;
    d.m.lastActivityAt = new Date(now);
    if (d.m.readyChallenger && d.m.readyOpponent) {
      const rules = rulesFrom(d.m.rules);
      d.m.status = "ACTIVE";
      d.m.startedAt = new Date(now);
      d.m.turnId = Math.random() < 0.5 ? d.m.challengerId : d.m.opponentId;
      d.m.phase = "PICK";
      d.m.phaseEndsAt = new Date(now + rules.pickSeconds * 1000);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Playing                                                            */
/* ------------------------------------------------------------------ */

function requireActive(d: Draft, phase: Phase | Phase[]) {
  if (d.m.status !== "ACTIVE") throw new ArenaError("This match isn't being played.", 409);
  if (d.m.pausedById) throw new ArenaError("The game is paused.", 409);
  const list = Array.isArray(phase) ? phase : [phase];
  if (!d.m.phase || !list.includes(d.m.phase)) throw new ArenaError("That isn't possible right now. The game has moved on.", 409);
}

export async function pick(matchId: string, traineeId: string, number: number) {
  return mutate(matchId, async (d, now) => {
    requirePlayer(d, traineeId);
    requireActive(d, "PICK");
    if (d.m.turnId !== traineeId) throw new ArenaError("It's not your turn to pick.", 403);
    const size = boardSize(rulesFrom(d.m.rules).questionsPerMatch);
    if (!Number.isInteger(number) || number < 1 || number > size) throw new ArenaError("Choose a number on the board.");
    if (usedNumbers(d).has(number)) throw new ArenaError("That number has already been used.", 409);
    bump(d, traineeId, "ok");
    d.m.lastActivityAt = new Date(now);
    await startRound(d, traineeId, number, now);
  });
}

export async function answer(matchId: string, traineeId: string, response: unknown) {
  return mutate(matchId, async (d, now) => {
    requirePlayer(d, traineeId);
    requireActive(d, ["ANSWER", "STEAL"]);
    const r = currentRound(d)!;
    const rules = rulesFrom(d.m.rules);
    const stealing = d.m.phase === "STEAL";
    if (!stealing && r.pickerId !== traineeId) throw new ArenaError("It's the other player's question.", 403);
    if (stealing && r.stealerId !== traineeId) throw new ArenaError("This bonus question isn't yours.", 403);
    const graded = await gradeEntry(entryOf(r), response);
    if (!graded) throw new ArenaError("Choose or complete an answer first.");
    d.m.lastActivityAt = new Date(now);
    if (!stealing) {
      r.firstResponse = response as object; r.firstCorrect = graded.correct; r.firstAt = new Date(now); markDirty(d, r);
      bump(d, traineeId, "ok");
      if (graded.correct) {
        const total = rules.questionSeconds * 1000;
        const remaining = Math.max(0, (d.m.phaseEndsAt?.getTime() ?? now) - now);
        await endRound(d, now, "FIRST", traineeId, firstPoints(r.basePoints, remaining, total));
      } else toSteal(d, now);
      return;
    }
    r.stealResponse = response as object; r.stealCorrect = graded.correct; r.stealAt = new Date(now); markDirty(d, r);
    if (graded.correct) await endRound(d, now, "STOLEN", traineeId, stealPoints(r.basePoints, rules.bonusPercent));
    else await endRound(d, now, "NONE", null, 0);
  });
}

export async function pause(matchId: string, traineeId: string) {
  return mutate(matchId, (d, now) => {
    requirePlayer(d, traineeId);
    if (d.m.status !== "ACTIVE") throw new ArenaError("This match isn't being played.", 409);
    if (d.m.pausedById) throw new ArenaError("The game is already paused.", 409);
    const rules = rulesFrom(d.m.rules);
    const used = isChallenger(d.m, traineeId) ? d.m.pausesUsedChallenger : d.m.pausesUsedOpponent;
    if (used >= rules.pausesPerPlayer) throw new ArenaError("You have no pauses left.", 409);
    if (isChallenger(d.m, traineeId)) d.m.pausesUsedChallenger += 1; else d.m.pausesUsedOpponent += 1;
    d.m.pausedById = traineeId;
    d.m.pausedAt = new Date(now);
    d.m.pauseRemainingMs = Math.max(0, (d.m.phaseEndsAt?.getTime() ?? now) - now);
    d.m.phaseEndsAt = null;
    d.m.lastActivityAt = new Date(now);
  });
}

export async function resume(matchId: string, traineeId: string) {
  return mutate(matchId, (d, now) => {
    requirePlayer(d, traineeId);
    if (!d.m.pausedById) throw new ArenaError("The game isn't paused.", 409);
    d.m.phaseEndsAt = new Date(now + (d.m.pauseRemainingMs ?? 0));
    d.m.pausedById = null; d.m.pausedAt = null; d.m.pauseRemainingMs = null;
    d.m.lastActivityAt = new Date(now);
  });
}

export async function sendMessage(matchId: string, traineeId: string, raw: unknown) {
  const body = cleanMessage(raw);
  if (!body) throw new ArenaError("Write a short message first.");
  const { match } = await mutate(matchId, (d) => {
    requirePlayer(d, traineeId);
    const open = d.m.status === "LOBBY" || (d.m.status === "ACTIVE" && !!d.m.pausedById);
    if (!open) throw new ArenaError("You can chat in the lobby and while the game is paused.", 409);
  });
  await prisma.arenaMessage.create({ data: { matchId, senderId: traineeId, body } });
  void pokeMatch(match, "message");
}

export async function react(matchId: string, traineeId: string, kind: string) {
  if (!(REACTION_KINDS as readonly string[]).includes(kind)) throw new ArenaError("Choose one of the reactions.");
  const { match } = await mutate(matchId, (d) => {
    requirePlayer(d, traineeId);
    if (!reactionsOpen(d.m.status, d.m.phase, d.m.pausedById !== null)) throw new ArenaError("Reactions open between questions.", 409);
  });
  await prisma.arenaReaction.create({ data: { matchId, senderId: traineeId, kind } });
  void prisma.arenaReaction.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 15 * 60_000) } } }).catch(() => undefined);
  void pokeMatch(match, "react");
}

/**
 * "Play again": asks the other player for a rematch with new questions. If they already asked, this accepts instead,
 * so two players pressing the button at the same moment end up in one lobby.
 */
export async function requestRematch(matchId: string, traineeId: string): Promise<{ id: string }> {
  const prev = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
  if (!prev || !isPlayer(prev, traineeId)) throw new ArenaError("That match could not be found.", 404);
  if (prev.status !== "COMPLETED" && prev.status !== "FORFEITED") throw new ArenaError("You can play again once the match is over.", 409);
  const other = otherPlayer(prev, traineeId);
  const open = await prisma.arenaMatch.findFirst({ where: { rematchOfId: matchId, status: { in: ["PENDING", "LOBBY", "ACTIVE"] } }, orderBy: { createdAt: "desc" } });
  if (open) {
    if (open.status === "PENDING" && open.challengerId === other) await respondToChallenge(open.id, traineeId, true);
    return { id: open.id };
  }
  const m = await createChallenge({ challengerId: traineeId, opponentId: other, courseId: prev.courseId, moduleId: prev.moduleId, rematchOfId: matchId });
  return { id: m.id };
}
