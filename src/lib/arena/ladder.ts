/**
 * Ayakbi Arena: the champion ladder, with the database. A finished match moves both players' ratings once (settleLadder), the boards
 * are read from the ratings and from the per-match changes, and the weekly champion is found and announced on first look (no cron).
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse } from "@/lib/arena/config";
import { ONLINE_SECONDS, ArenaError } from "@/lib/arena/arena";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";
import { pushToCourse } from "@/lib/arena/chatPush";
import { START_RATING, MIN_MATCHES, SAME_PAIR_DAILY_LIMIT, CHAMPION_MIN_MATCHES, ratingDelta, tierOf, progressToNext, weekStart, periodStart, type Period } from "@/lib/arena/ladderCore";

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** Moves both players' ratings for a finished match. Safe to call twice: the second call changes nothing. */
export async function settleLadder(matchId: string): Promise<void> {
  try {
    const m = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
    if (!m || (m.status !== "COMPLETED" && m.status !== "FORFEITED") || !m.startedAt || m.endReason === "abandoned") return;
    if (!(await availabilityForCourse(m.courseId)).ladder) return;
    if (await prisma.arenaRatingChange.findFirst({ where: { matchId }, select: { id: true } })) return;

    const [a, b] = [m.challengerId, m.opponentId];
    const day = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const today = await prisma.arenaMatch.findMany({ where: { courseId: m.courseId, id: { not: matchId }, endedAt: { gte: day }, status: { in: ["COMPLETED", "FORFEITED"] }, OR: [{ challengerId: a, opponentId: b }, { challengerId: b, opponentId: a }] }, select: { id: true } });
    const earlier = today.length ? await prisma.arenaRatingChange.count({ where: { traineeId: a, counted: true, matchId: { in: today.map((x) => x.id) } } }) : 0;
    const counted = earlier < SAME_PAIR_DAILY_LIMIT;

    const score = (id: string): 0 | 0.5 | 1 => (m.winnerId === null ? 0.5 : m.winnerId === id ? 1 : 0);
    await prisma.$transaction(async (tx) => {
      const rows = await Promise.all([a, b].map((id) => tx.arenaRating.upsert({ where: { traineeId_courseId: { traineeId: id, courseId: m.courseId } }, create: { traineeId: id, courseId: m.courseId }, update: {} })));
      const [ra, rb] = rows;
      const deltas: [number, number] = [counted ? ratingDelta(ra.rating, rb.rating, score(a)) : 0, counted ? ratingDelta(rb.rating, ra.rating, score(b)) : 0];
      for (const [i, id] of [a, b].entries()) {
        const row = rows[i]; const s = score(id); const delta = deltas[i];
        const result = s === 1 ? "WIN" : s === 0 ? "LOSS" : "DRAW";
        await tx.arenaRatingChange.create({ data: { matchId, traineeId: id, courseId: m.courseId, before: row.rating, after: row.rating + delta, delta, counted, result } });
        if (counted) await tx.arenaRating.update({ where: { traineeId_courseId: { traineeId: id, courseId: m.courseId } }, data: { rating: row.rating + delta, matches: { increment: 1 }, wins: { increment: s === 1 ? 1 : 0 }, losses: { increment: s === 0 ? 1 : 0 }, draws: { increment: s === 0.5 ? 1 : 0 } } });
      }
    });
    void pokeMany([{ channel: channels.course(m.courseId), message: { v: 0, k: "lobby" } }]);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return; // the other call got there first
    console.error("Ladder update failed:", e);
  }
}

export interface RatingInfo { rating: number; tier: string; tierKey: string }
const info = (rating: number): RatingInfo => { const t = tierOf(rating); return { rating, tier: t.label, tierKey: t.tier }; };

/** Rating and tier for some players (those with no rating yet start at the beginning). */
export async function ratingsFor(courseId: string, ids: string[]): Promise<Map<string, RatingInfo>> {
  const rows = ids.length ? await prisma.arenaRating.findMany({ where: { courseId, traineeId: { in: ids } }, select: { traineeId: true, rating: true } }) : [];
  const map = new Map<string, RatingInfo>(ids.map((id) => [id, info(START_RATING)]));
  for (const r of rows) map.set(r.traineeId, info(r.rating));
  return map;
}

/** All-time place among the players who count (enough matches, not hidden). Null when the player is not on the ladder. */
export async function rankOf(courseId: string, traineeId: string): Promise<number | null> {
  const mine = await prisma.arenaRating.findUnique({ where: { traineeId_courseId: { traineeId, courseId } } });
  if (!mine || mine.hidden || mine.matches < MIN_MATCHES) return null;
  return 1 + (await prisma.arenaRating.count({ where: { courseId, hidden: false, matches: { gte: MIN_MATCHES }, rating: { gt: mine.rating } } }));
}

export interface LadderEntry { rank: number; id: string; name: string; initials: string; rating: number; tier: string; tierKey: string; change: number; matches: number; online: boolean; mine: boolean; champion: boolean }
export interface LadderView {
  enabled: boolean;
  period: Period;
  weekLabel: string;
  entries: LadderEntry[];
  me: { rank: number | null; rating: number; tier: string; tierKey: string; matches: number; needMore: number; toNext: { next: string; toNext: number; fraction: number } | null; change: number };
  champion: { id: string; name: string } | null;
}

const weekNumber = (d: Date) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7); };

const announced = new Map<string, number>();

/** Last week's champion: found on first look and announced once in the course chat. */
export async function ensureChampion(courseId: string): Promise<{ id: string; name: string } | null> {
  const thisWeek = weekStart(Date.now());
  const lastWeek = new Date(thisWeek.getTime() - 7 * 86_400_000);
  const existing = await prisma.arenaChampion.findUnique({ where: { courseId_weekStart: { courseId, weekStart: lastWeek } }, include: { trainee: { select: { id: true, name: true } } } });
  if (existing) return existing.trainee;
  if (Date.now() - (announced.get(courseId) ?? 0) < 60_000) return null;
  announced.set(courseId, Date.now());
  const sums = await prisma.arenaRatingChange.groupBy({ by: ["traineeId"], where: { courseId, counted: true, createdAt: { gte: lastWeek, lt: thisWeek } }, _sum: { delta: true }, _count: { _all: true } });
  const hidden = await prisma.arenaRating.findMany({ where: { courseId, hidden: true }, select: { traineeId: true } });
  const out = new Set(hidden.map((h) => h.traineeId));
  const best = sums.filter((s) => !out.has(s.traineeId) && s._count._all >= CHAMPION_MIN_MATCHES && (s._sum.delta ?? 0) > 0).sort((x, y) => (y._sum.delta ?? 0) - (x._sum.delta ?? 0))[0];
  if (!best) return null;
  try {
    await prisma.arenaChampion.create({ data: { courseId, weekStart: lastWeek, traineeId: best.traineeId, points: best._sum.delta ?? 0 } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
  const who = await prisma.trainee.findUnique({ where: { id: best.traineeId }, select: { id: true, name: true } });
  if (who && (await availabilityForCourse(courseId)).chat) {
    await prisma.arenaChatMessage.create({ data: { courseId, senderId: null, kind: "SYSTEM", body: `👑 ${who.name} is last week's champion with +${best._sum.delta} ladder points.` } });
    void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
    void pushToCourse(courseId, null, { title: "👑 New weekly champion", body: `${who.name} topped the ladder last week.`, url: `/trainee/arena/${courseId}/ladder` });
  }
  return who;
}

export async function ladderView(courseId: string, viewerId: string, period: Period): Promise<LadderView> {
  const now = Date.now();
  const enabled = (await availabilityForCourse(courseId)).ladder;
  const from = periodStart(period, now);
  const weekFrom = weekStart(now);
  const empty: LadderView = { enabled, period, weekLabel: `Week ${weekNumber(new Date(now))}`, entries: [], me: { rank: null, rating: START_RATING, tier: "Silver", tierKey: "SILVER", matches: 0, needMore: MIN_MATCHES, toNext: progressToNext(START_RATING), change: 0 }, champion: null };
  if (!enabled) return empty;

  const [ratings, weekly, champion] = await Promise.all([
    prisma.arenaRating.findMany({ where: { courseId, hidden: false, matches: { gte: MIN_MATCHES } }, include: { trainee: { select: { id: true, name: true } } } }),
    prisma.arenaRatingChange.groupBy({ by: ["traineeId"], where: { courseId, counted: true, createdAt: { gte: from ?? weekFrom } }, _sum: { delta: true }, _count: { _all: true } }),
    ensureChampion(courseId),
  ]);
  const gain = new Map(weekly.map((w) => [w.traineeId, w._sum.delta ?? 0]));
  const played = new Set(weekly.map((w) => w.traineeId));
  const weekGain = period === "all" ? gain : new Map(gain);
  let pool = ratings;
  if (period !== "all") pool = ratings.filter((r) => played.has(r.traineeId));
  pool = [...pool].sort((x, y) => (period === "all" ? y.rating - x.rating : (weekGain.get(y.traineeId) ?? 0) - (weekGain.get(x.traineeId) ?? 0) || y.rating - x.rating));
  const present = await prisma.arenaPresence.findMany({ where: { courseId, lastSeenAt: { gte: new Date(now - ONLINE_SECONDS * 1000) } }, select: { traineeId: true } });
  const online = new Set(present.map((p) => p.traineeId));
  const entries: LadderEntry[] = pool.slice(0, 50).map((r, i) => ({
    rank: i + 1, id: r.traineeId, name: r.trainee.name, initials: initialsOf(r.trainee.name), rating: r.rating, ...(({ tier, tierKey }) => ({ tier, tierKey }))(info(r.rating)),
    change: period === "all" ? gain.get(r.traineeId) ?? 0 : weekGain.get(r.traineeId) ?? 0, matches: r.matches, online: online.has(r.traineeId), mine: r.traineeId === viewerId, champion: champion?.id === r.traineeId,
  }));

  const mine = await prisma.arenaRating.findUnique({ where: { traineeId_courseId: { traineeId: viewerId, courseId } } });
  const rating = mine?.rating ?? START_RATING;
  const myEntry = entries.find((e) => e.mine);
  const rank = myEntry?.rank ?? (mine && !mine.hidden && mine.matches >= MIN_MATCHES ? pool.findIndex((r) => r.traineeId === viewerId) + 1 || null : null);
  return {
    enabled, period, weekLabel: empty.weekLabel, entries, champion,
    me: { rank, rating, tier: tierOf(rating).label, tierKey: tierOf(rating).tier, matches: mine?.matches ?? 0, needMore: Math.max(0, MIN_MATCHES - (mine?.matches ?? 0)), toNext: progressToNext(rating), change: gain.get(viewerId) ?? 0 },
  };
}

/** What the finished match did to one player, for the result screen. */
export async function matchLadderResult(matchId: string, traineeId: string, courseId: string) {
  const c = await prisma.arenaRatingChange.findUnique({ where: { matchId_traineeId: { matchId, traineeId } } });
  if (!c) return null;
  const rank = await rankOf(courseId, traineeId);
  return { delta: c.delta, before: c.before, after: c.after, counted: c.counted, tier: tierOf(c.after).label, tierKey: tierOf(c.after).tier, tierUp: tierOf(c.after).tier !== tierOf(c.before).tier && c.after > c.before, toNext: progressToNext(c.after), rank };
}

/* ------------------------------ instructor ------------------------------ */

export async function adminLadder(courseId: string) {
  const rows = await prisma.arenaRating.findMany({ where: { courseId, matches: { gte: 1 } }, orderBy: { rating: "desc" }, take: 60, include: { trainee: { select: { name: true } } } });
  return { on: (await availabilityForCourse(courseId)).ladder, players: rows.map((r) => ({ id: r.traineeId, name: r.trainee.name, rating: r.rating, tier: tierOf(r.rating).label, matches: r.matches, hidden: r.hidden })) };
}

export async function setLadderHidden(courseId: string, traineeId: string, hidden: boolean): Promise<void> {
  const enrolled = await prisma.courseEnrollment.findFirst({ where: { courseId, traineeId }, select: { id: true } });
  if (!enrolled) throw new ArenaError("That trainee isn't enrolled in this course.", 404);
  await prisma.arenaRating.upsert({ where: { traineeId_courseId: { traineeId, courseId } }, create: { traineeId, courseId, hidden }, update: { hidden } });
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "lobby" } }]);
}
