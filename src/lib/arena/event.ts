/**
 * Ayakbi Arena: live events. An instructor opens an event for a course, trainees join, and the event runs as a single knockout:
 * the system pairs players (strongest ladder ratings apart), puts each pair in a match lobby, and moves winners on until a champion
 * is crowned. Matches are ordinary arena matches (`ArenaMatch.eventId`), so they count on the ladder and can be watched.
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse, resolveForCourse } from "@/lib/arena/config";
import { rulesFrom } from "@/lib/arena/arenaCore";
import { poolFor } from "@/lib/arena/arenaPool";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { activeSuspension } from "@/lib/arena/suspension";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";
import { pushToCourse } from "@/lib/arena/chatPush";
import { sendPushForNotification } from "@/lib/push/send";
import { tierOf } from "@/lib/arena/ladderCore";
import { MAX_PLAYERS, MIN_PLAYERS, NO_SHOW_MINUTES, firstRound, noShowWinner, roundName, totalRoundsFor } from "@/lib/arena/eventCore";

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const poke = (courseId: string) => void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "lobby" } }]);

/* ------------------------------ running an event ------------------------------ */

export async function createEvent(courseId: string, staffId: string, input: { name: string; questionsPerMatch?: number; moduleId?: string | null }) {
  if (!(await availabilityForCourse(courseId)).events) throw new ArenaError("Live events aren't switched on for this course.", 403);
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new ArenaError("Give the event a name.");
  if (await prisma.arenaEvent.findFirst({ where: { courseId, status: { in: ["SIGNUP", "LIVE"] } }, select: { id: true } })) throw new ArenaError("This course already has an event that is open or running.", 409);
  if (input.moduleId && !(await prisma.module.findFirst({ where: { id: input.moduleId, courseId }, select: { id: true } }))) throw new ArenaError("That topic isn't part of this course.", 404);
  const pool = await poolFor(courseId, input.moduleId ?? null);
  if (pool.length < 4) throw new ArenaError("This course doesn't have enough approved questions to play yet.", 409);
  const questionsPerMatch = Math.min(pool.length, Math.min(30, Math.max(4, Math.round(input.questionsPerMatch ?? 10))));
  const event = await prisma.arenaEvent.create({ data: { courseId, name, questionsPerMatch, moduleId: input.moduleId ?? null, createdById: staffId } });
  poke(courseId);
  void pushToCourse(courseId, null, { title: `⚔️ ${name} is open`, body: "Join the live event before it starts.", url: `/trainee/arena/${courseId}/event/${event.id}` });
  return event;
}

export async function joinEvent(traineeId: string, eventId: string) {
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, include: { _count: { select: { players: true } } } });
  if (!ev) throw new ArenaError("That event could not be found.", 404);
  if (ev.status !== "SIGNUP") throw new ArenaError("This event has already started.", 409);
  if (!(await isEnrolled(traineeId, ev.courseId))) throw new ArenaError("The event is for trainees enrolled in this course.", 403);
  if (await activeSuspension(traineeId, ev.courseId)) throw new ArenaError("You can't join while you are suspended from the arena.", 403);
  if (ev._count.players >= MAX_PLAYERS) throw new ArenaError("The event is full.", 409);
  await prisma.arenaEventPlayer.upsert({ where: { eventId_traineeId: { eventId, traineeId } }, create: { eventId, traineeId }, update: {} });
  poke(ev.courseId);
}

export async function leaveEvent(traineeId: string, eventId: string) {
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, select: { status: true, courseId: true } });
  if (!ev || ev.status !== "SIGNUP") throw new ArenaError("You can only leave before the event starts.", 409);
  await prisma.arenaEventPlayer.deleteMany({ where: { eventId, traineeId } });
  poke(ev.courseId);
}

export async function removeEventPlayer(eventId: string, traineeId: string) {
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, select: { status: true, courseId: true } });
  if (!ev || ev.status !== "SIGNUP") throw new ArenaError("Players can only be removed before the event starts.", 409);
  await prisma.arenaEventPlayer.deleteMany({ where: { eventId, traineeId } });
  poke(ev.courseId);
}

export async function startEvent(eventId: string) {
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, include: { players: true } });
  if (!ev) throw new ArenaError("That event could not be found.", 404);
  if (ev.status !== "SIGNUP") throw new ArenaError("This event has already started.", 409);
  if (ev.players.length < MIN_PLAYERS) throw new ArenaError(`At least ${MIN_PLAYERS} players need to join first.`);
  const ratings = await prisma.arenaRating.findMany({ where: { courseId: ev.courseId, traineeId: { in: ev.players.map((p) => p.traineeId) } }, select: { traineeId: true, rating: true } });
  const rating = new Map(ratings.map((r) => [r.traineeId, r.rating]));
  const ordered = [...ev.players].sort((a, b) => (rating.get(b.traineeId) ?? 1000) - (rating.get(a.traineeId) ?? 1000) || a.joinedAt.getTime() - b.joinedAt.getTime());
  const totalRounds = totalRoundsFor(ordered.length);
  const claimed = await prisma.arenaEvent.updateMany({ where: { id: eventId, status: "SIGNUP" }, data: { status: "LIVE", startedAt: new Date(), round: 1, totalRounds } });
  if (claimed.count === 0) throw new ArenaError("This event has already started.", 409);
  for (const [i, p] of ordered.entries()) await prisma.arenaEventPlayer.update({ where: { eventId_traineeId: { eventId, traineeId: p.traineeId } }, data: { seed: i + 1 } });
  // Every tie of every round exists from the start; later rounds fill in as winners come through.
  const first = firstRound(ordered.map((p) => p.traineeId));
  for (let r = 1; r <= totalRounds; r++) {
    const count = 2 ** (totalRounds - r);
    for (let slot = 0; slot < count; slot++) {
      const t = r === 1 ? first[slot] : null;
      await prisma.arenaEventTie.create({ data: { eventId, round: r, slot, aId: t?.a ?? null, bId: t?.b ?? null, bye: t?.bye ?? false } });
    }
  }
  // Byes go through at once; real pairings are called.
  const ties = await prisma.arenaEventTie.findMany({ where: { eventId, round: 1 }, orderBy: { slot: "asc" } });
  for (const t of ties) {
    if (t.bye) await finishTie(t.id, (t.aId ?? t.bId)!);
    else await callTie(t.id);
  }
  poke(ev.courseId);
}

/** Puts a tie's two players in a match lobby and tells them. */
async function callTie(tieId: string) {
  const tie = await prisma.arenaEventTie.findUnique({ where: { id: tieId }, include: { event: true } });
  if (!tie || !tie.aId || !tie.bId || tie.status === "DONE" || tie.event.status !== "LIVE") return;
  const rules = rulesFrom(await resolveForCourse(tie.event.courseId));
  const pool = await poolFor(tie.event.courseId, tie.event.moduleId);
  const length = Math.min(tie.event.questionsPerMatch, pool.length);
  const m = await prisma.arenaMatch.create({
    data: { courseId: tie.event.courseId, moduleId: tie.event.moduleId, challengerId: tie.aId, opponentId: tie.bId, status: "LOBBY", rules: { ...rules, questionsPerMatch: length } as never, expiresAt: new Date(Date.now() + 20 * 60_000), eventId: tie.eventId, eventTieId: tie.id },
  });
  await prisma.arenaEventTie.update({ where: { id: tieId }, data: { matchId: m.id, status: "READY", calledAt: new Date() } });
  const names = await prisma.trainee.findMany({ where: { id: { in: [tie.aId, tie.bId] } }, select: { id: true, name: true } });
  const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? "your opponent";
  for (const [me, other] of [[tie.aId, tie.bId], [tie.bId, tie.aId]] as const) {
    const note = { type: "ARENA_EVENT_MATCH", title: `Your match is ready · ${tie.event.name}`, body: `${roundName(tie.round, tie.event.totalRounds)} against ${nameOf(other).split(" ")[0]}. Tap Ready within ${NO_SHOW_MINUTES} minutes.`, url: `/trainee/arena/match/${m.id}` };
    await prisma.userNotification.create({ data: { recipientType: "TRAINEE", recipientId: me, ...note } }).catch(() => undefined);
    void sendPushForNotification("TRAINEE", me, note);
    void pokeMany([{ channel: channels.user(me), message: { v: m.version, k: "challenge" } }]);
  }
}

/** A tie has a winner: move them on, call the next tie when both of its players are known, crown the champion after the final. */
export async function finishTie(tieId: string, winnerId: string) {
  const done = await prisma.arenaEventTie.updateMany({ where: { id: tieId, status: { not: "DONE" } }, data: { status: "DONE", winnerId } });
  if (done.count === 0) return;
  const tie = await prisma.arenaEventTie.findUnique({ where: { id: tieId }, include: { event: true } });
  if (!tie) return;
  const ev = tie.event;
  if (tie.round >= ev.totalRounds) {
    await prisma.arenaEvent.update({ where: { id: ev.id }, data: { status: "DONE", endedAt: new Date(), championId: winnerId } });
    const who = await prisma.trainee.findUnique({ where: { id: winnerId }, select: { name: true } });
    if ((await availabilityForCourse(ev.courseId)).chat) {
      await prisma.arenaChatMessage.create({ data: { courseId: ev.courseId, senderId: null, kind: "SYSTEM", body: `👑 ${who?.name ?? "A player"} won ${ev.name}!` } });
      void pokeMany([{ channel: channels.course(ev.courseId), message: { v: 0, k: "chat" } }]);
    }
    void pushToCourse(ev.courseId, null, { title: `👑 ${ev.name} has a champion`, body: `${who?.name ?? "A player"} won the live event.`, url: `/trainee/arena/${ev.courseId}/event/${ev.id}` });
    poke(ev.courseId);
    return;
  }
  const nextSlot = Math.floor(tie.slot / 2);
  const side = tie.slot % 2 === 0 ? { aId: winnerId } : { bId: winnerId };
  const next = await prisma.arenaEventTie.update({ where: { eventId_round_slot: { eventId: ev.id, round: tie.round + 1, slot: nextSlot } }, data: side });
  if (next.aId && next.bId) await callTie(next.id);
  const live = await prisma.arenaEventTie.findFirst({ where: { eventId: ev.id, status: { not: "DONE" } }, orderBy: [{ round: "asc" }, { slot: "asc" }], select: { round: true } });
  if (live && live.round !== ev.round) await prisma.arenaEvent.update({ where: { id: ev.id }, data: { round: live.round } });
  poke(ev.courseId);
}

/** Called when a match ends: if it belonged to an event, settle its tie (a draw is played again). */
export async function onEventMatchEnd(matchId: string) {
  try {
    const m = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
    if (!m?.eventTieId) return;
    const tie = await prisma.arenaEventTie.findUnique({ where: { id: m.eventTieId } });
    if (!tie || tie.status === "DONE" || tie.matchId !== matchId) return;
    if ((m.status === "COMPLETED" || m.status === "FORFEITED") && m.winnerId) return void (await finishTie(tie.id, m.winnerId));
    // A draw, or a match that was cancelled or lapsed: put the pair in a fresh lobby.
    await prisma.arenaEventTie.update({ where: { id: tie.id }, data: { status: "PENDING", matchId: null } });
    await callTie(tie.id);
  } catch (e) {
    console.error("Event update failed:", e);
  }
}

/** Anyone who has not tapped Ready within the limit loses the tie (nobody ready: the better seed goes through). */
export async function sweepEvent(eventId: string) {
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!ev || ev.status !== "LIVE") return;
  const cutoff = new Date(Date.now() - NO_SHOW_MINUTES * 60_000);
  const late = await prisma.arenaEventTie.findMany({ where: { eventId, status: "READY", calledAt: { lt: cutoff }, matchId: { not: null } } });
  for (const t of late) {
    const m = await prisma.arenaMatch.findUnique({ where: { id: t.matchId! } });
    if (!m || m.status !== "LOBBY" || !t.aId || !t.bId) continue;
    const seeds = await prisma.arenaEventPlayer.findMany({ where: { eventId, traineeId: { in: [t.aId, t.bId] } } });
    const seed = (id: string) => seeds.find((s) => s.traineeId === id)?.seed ?? 99;
    const winner = noShowWinner({ id: t.aId, seed: seed(t.aId), ready: m.readyChallenger }, { id: t.bId, seed: seed(t.bId), ready: m.readyOpponent });
    await prisma.arenaMatch.updateMany({ where: { id: m.id, status: "LOBBY" }, data: { status: "CANCELLED", endedAt: new Date(), endReason: "no-show" } });
    await finishTie(t.id, winner);
  }
}

export async function walkover(eventId: string, tieId: string, winnerId: string) {
  const t = await prisma.arenaEventTie.findFirst({ where: { id: tieId, eventId } });
  if (!t || t.status === "DONE" || (t.aId !== winnerId && t.bId !== winnerId)) throw new ArenaError("That pairing can't be settled that way.", 404);
  if (t.matchId) await prisma.arenaMatch.updateMany({ where: { id: t.matchId, status: { in: ["LOBBY", "ACTIVE", "PENDING"] } }, data: { status: "CANCELLED", endedAt: new Date(), endReason: "walkover" } });
  await finishTie(tieId, winnerId);
}

export async function cancelEvent(eventId: string) {
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, select: { courseId: true, status: true } });
  if (!ev || (ev.status !== "SIGNUP" && ev.status !== "LIVE")) throw new ArenaError("That event is not running.", 409);
  await prisma.arenaEvent.update({ where: { id: eventId }, data: { status: "CANCELLED", endedAt: new Date() } });
  await prisma.arenaMatch.updateMany({ where: { eventId, status: { in: ["LOBBY", "PENDING"] } }, data: { status: "CANCELLED", endedAt: new Date(), endReason: "event-cancelled" } });
  poke(ev.courseId);
}

/* ------------------------------ what people see ------------------------------ */

export interface EventPlayerView { id: string; name: string; initials: string; seed: number; tier: string; tierKey: string }
export interface EventTieView {
  id: string; round: number; slot: number; a: EventPlayerView | null; b: EventPlayerView | null; winnerId: string | null; bye: boolean;
  status: string; matchId: string | null; scoreA: number | null; scoreB: number | null; playing: boolean; question: number | null; questions: number | null; watching: number; readyA: boolean; readyB: boolean;
}
export interface EventView {
  id: string; courseId: string; courseTitle: string; name: string; status: string; round: number; totalRounds: number;
  rounds: { round: number; name: string; ties: EventTieView[] }[];
  players: EventPlayerView[]; joined: boolean; champion: EventPlayerView | null;
  mine: null | { state: "CALLED" | "WAITING" | "OUT" | "CHAMPION"; tieId: string | null; matchId: string | null; opponent: string | null; round: string | null };
  serverNow: number;
}

export async function eventView(eventId: string, viewerId: string | null): Promise<EventView> {
  await sweepEvent(eventId);
  const ev = await prisma.arenaEvent.findUnique({ where: { id: eventId }, include: { players: true, ties: { orderBy: [{ round: "asc" }, { slot: "asc" }] }, course: { select: { title: true } } } });
  if (!ev) throw new ArenaError("That event could not be found.", 404);
  const ids = Array.from(new Set([...ev.players.map((p) => p.traineeId), ...ev.ties.flatMap((t) => [t.aId, t.bId].filter((x): x is string => !!x))]));
  const [people, ratings] = await Promise.all([
    prisma.trainee.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.arenaRating.findMany({ where: { courseId: ev.courseId, traineeId: { in: ids } }, select: { traineeId: true, rating: true } }),
  ]);
  const name = new Map(people.map((p) => [p.id, p.name]));
  const rating = new Map(ratings.map((r) => [r.traineeId, r.rating]));
  const seed = new Map(ev.players.map((p) => [p.traineeId, p.seed]));
  const pv = (id: string | null): EventPlayerView | null => {
    if (!id) return null;
    const t = tierOf(rating.get(id) ?? 1000);
    return { id, name: name.get(id) ?? "Player", initials: initialsOf(name.get(id) ?? "?"), seed: seed.get(id) ?? 0, tier: t.label, tierKey: t.tier };
  };
  const matchIds = ev.ties.map((t) => t.matchId).filter((x): x is string => !!x);
  const [matches, watchers] = await Promise.all([
    matchIds.length ? prisma.arenaMatch.findMany({ where: { id: { in: matchIds } }, select: { id: true, status: true, scoreChallenger: true, scoreOpponent: true, roundNo: true, rules: true, readyChallenger: true, readyOpponent: true } }) : [],
    matchIds.length ? prisma.arenaSpectator.groupBy({ by: ["matchId"], where: { matchId: { in: matchIds }, lastSeenAt: { gte: new Date(Date.now() - 30_000) } }, _count: { _all: true } }) : [],
  ]);
  const mById = new Map(matches.map((m) => [m.id, m]));
  const wById = new Map(watchers.map((w) => [w.matchId, w._count._all]));
  const tieViews: EventTieView[] = ev.ties.map((t) => {
    const m = t.matchId ? mById.get(t.matchId) : undefined;
    const rules = m ? rulesFrom(m.rules) : null;
    return { id: t.id, round: t.round, slot: t.slot, a: pv(t.aId), b: pv(t.bId), winnerId: t.winnerId, bye: t.bye, status: t.status, matchId: t.matchId, scoreA: m ? m.scoreChallenger : null, scoreB: m ? m.scoreOpponent : null, playing: m?.status === "ACTIVE", question: m && m.status === "ACTIVE" ? m.roundNo : null, questions: rules?.questionsPerMatch ?? null, watching: t.matchId ? wById.get(t.matchId) ?? 0 : 0, readyA: !!m?.readyChallenger, readyB: !!m?.readyOpponent };
  });
  const rounds = Array.from({ length: ev.totalRounds }, (_, i) => ({ round: i + 1, name: roundName(i + 1, ev.totalRounds), ties: tieViews.filter((t) => t.round === i + 1) }));
  let mine: EventView["mine"] = null;
  if (viewerId && ev.players.some((p) => p.traineeId === viewerId) && ev.status !== "SIGNUP") {
    const open = ev.ties.find((t) => t.status !== "DONE" && (t.aId === viewerId || t.bId === viewerId) && t.aId && t.bId);
    if (ev.championId === viewerId) mine = { state: "CHAMPION", tieId: null, matchId: null, opponent: null, round: null };
    else if (open) mine = { state: "CALLED", tieId: open.id, matchId: open.matchId, opponent: name.get(open.aId === viewerId ? open.bId! : open.aId!) ?? null, round: roundName(open.round, ev.totalRounds) };
    else if (ev.ties.some((t) => t.status !== "DONE" && (t.aId === viewerId || t.bId === viewerId))) mine = { state: "WAITING", tieId: null, matchId: null, opponent: null, round: null };
    else mine = { state: "OUT", tieId: null, matchId: null, opponent: null, round: null };
  }
  return {
    id: ev.id, courseId: ev.courseId, courseTitle: ev.course.title, name: ev.name, status: ev.status, round: ev.round, totalRounds: ev.totalRounds, rounds,
    players: ev.players.map((p) => pv(p.traineeId)!).sort((a, b) => (a.seed || 99) - (b.seed || 99) || a.name.localeCompare(b.name)),
    joined: !!viewerId && ev.players.some((p) => p.traineeId === viewerId), champion: pv(ev.championId), mine, serverNow: Date.now(),
  };
}

/** The event to show on the lobby: open or running, or finished in the last two hours. */
export async function courseEvent(courseId: string, viewerId: string) {
  const ev = await prisma.arenaEvent.findFirst({ where: { courseId, OR: [{ status: { in: ["SIGNUP", "LIVE"] } }, { status: "DONE", endedAt: { gte: new Date(Date.now() - 2 * 3_600_000) } }] }, orderBy: { createdAt: "desc" }, include: { _count: { select: { players: true } }, players: { where: { traineeId: viewerId }, select: { traineeId: true } } } });
  return ev ? { id: ev.id, name: ev.name, status: ev.status, players: ev._count.players, joined: ev.players.length > 0 } : null;
}

export async function adminEvents(courseId: string) {
  const [avail, rows] = await Promise.all([availabilityForCourse(courseId), prisma.arenaEvent.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 8, include: { _count: { select: { players: true } } } })]);
  return { on: avail.events, events: rows.map((e) => ({ id: e.id, name: e.name, status: e.status, players: e._count.players, round: e.round, totalRounds: e.totalRounds, at: e.createdAt.getTime() })) };
}
