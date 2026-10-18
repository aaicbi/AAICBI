/**
 * Ayakbi Arena: spectators. Coursemates watch a live match and cheer with emojis. A spectator sees what a player sees (scores, clock,
 * the question) but the answer only appears when the round is revealed, and nothing typed ever reaches a player. Watching changes nothing
 * in the match, the ladder or anyone's score.
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse, resolveForCourse } from "@/lib/arena/config";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { activeSuspension } from "@/lib/arena/suspension";
import { viewMatch, type MatchView } from "@/lib/arena/arenaView";
import { ratingsFor } from "@/lib/arena/ladder";
import { EMOJI_KINDS } from "@/lib/arena/spectateCore";

const WATCHING_MS = 30_000;

async function allow(traineeId: string, matchId: string) {
  const m = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
  if (!m) throw new ArenaError("That match could not be found.", 404);
  if (m.challengerId === traineeId || m.opponentId === traineeId) throw new ArenaError("You are playing in this match.", 409);
  const mode = (await availabilityForCourse(m.courseId)).spectators;
  if (mode === "OFF" || (mode === "LIVE" && !m.eventId)) throw new ArenaError("Watching matches isn't open for this course right now.", 403);
  if (!(await isEnrolled(traineeId, m.courseId))) throw new ArenaError("Watching is for trainees enrolled in this course.", 403);
  if (await activeSuspension(traineeId, m.courseId)) throw new ArenaError("You can't watch while you are suspended from the arena.", 403);
  return m;
}

export interface SpectateView {
  id: string; status: string; courseId: string; courseTitle: string; topic: string | null; event: { id: string } | null;
  a: { name: string; initials: string; score: number; tier: string | null; tierKey: string | null };
  b: { name: string; initials: string; score: number; tier: string | null; tierKey: string | null };
  phase: MatchView["phase"]; phaseEndsAt: number | null; roundNo: number; totalRounds: number; turn: "a" | "b" | null;
  round: null | { number: number; format: string; points: number; stage: "ANSWER" | "STEAL" | "REVEAL"; answerer: "a" | "b"; served: NonNullable<MatchView["round"]>["served"] };
  reveal: null | { outcome: string; awardedTo: "a" | "b" | null; points: number; answer: NonNullable<MatchView["reveal"]>["answer"] };
  result: null | { winner: "a" | "b" | "draw" };
  watching: number; cheers: { id: string; kind: string; at: number }[]; serverNow: number;
}

export async function spectateView(traineeId: string, matchId: string): Promise<SpectateView> {
  const m0 = await allow(traineeId, matchId);
  const spectators = await prisma.arenaSpectator.count({ where: { matchId, traineeId: { not: traineeId }, lastSeenAt: { gte: new Date(Date.now() - WATCHING_MS) } } });
  const cap = (await resolveForCourse(m0.courseId)).spectatorCap;
  if (spectators >= cap) throw new ArenaError("This match is full.", 409);
  await prisma.arenaSpectator.upsert({ where: { matchId_traineeId: { matchId, traineeId } }, create: { matchId, traineeId }, update: { lastSeenAt: new Date() } });
  // The match as its challenger sees it: every field below is also visible to the other player.
  const v = await viewMatch(matchId, m0.challengerId);
  const side = (x: "me" | "opponent" | null): "a" | "b" | null => (x === "me" ? "a" : x === "opponent" ? "b" : null);
  const ratings = await ratingsFor(m0.courseId, [m0.challengerId, m0.opponentId]);
  const ra = ratings.get(m0.challengerId); const rb = ratings.get(m0.opponentId);
  const watching = await prisma.arenaSpectator.count({ where: { matchId, lastSeenAt: { gte: new Date(Date.now() - WATCHING_MS) } } });
  void prisma.arenaSpectator.deleteMany({ where: { lastSeenAt: { lt: new Date(Date.now() - 2 * 3_600_000) } } }).catch(() => undefined);
  return {
    id: v.id, status: v.status, courseId: v.courseId, courseTitle: v.courseTitle, topic: v.topic, event: m0.eventId ? { id: m0.eventId } : null,
    a: { name: v.me.name, initials: v.me.initials, score: v.me.score, tier: ra?.tier ?? null, tierKey: ra?.tierKey ?? null },
    b: { name: v.opponent.name, initials: v.opponent.initials, score: v.opponent.score, tier: rb?.tier ?? null, tierKey: rb?.tierKey ?? null },
    phase: v.phase, phaseEndsAt: v.phaseEndsAt, roundNo: v.roundNo, totalRounds: v.totalRounds, turn: side(v.turn),
    round: v.round ? { number: v.round.number, format: v.round.format, points: v.round.points, stage: v.round.stage, answerer: side(v.round.answerer)!, served: v.round.served } : null,
    reveal: v.reveal ? { outcome: v.reveal.outcome, awardedTo: side(v.reveal.awardedTo), points: v.reveal.points, answer: v.reveal.answer } : null,
    result: v.result ? { winner: v.result.winner === "draw" ? "draw" : (side(v.result.winner)!) } : null,
    watching, cheers: v.spectators.cheers, serverNow: Date.now(),
  };
}

const lastCheer = new Map<string, number>();

export async function cheer(traineeId: string, matchId: string, kind: unknown) {
  if (typeof kind !== "string" || !EMOJI_KINDS.includes(kind)) throw new ArenaError("Choose one of the cheers.");
  await allow(traineeId, matchId);
  const now = Date.now();
  if (now - (lastCheer.get(traineeId) ?? 0) < 800) return;
  lastCheer.set(traineeId, now);
  if (lastCheer.size > 5000) lastCheer.clear();
  await prisma.arenaCheer.create({ data: { matchId, traineeId, kind } });
  void prisma.arenaCheer.deleteMany({ where: { createdAt: { lt: new Date(now - 3_600_000) } } }).catch(() => undefined);
}
