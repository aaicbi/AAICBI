/**
 * Game results, the database half. Who plays the games and how they do, gathered from the three places games are played: course games
 * (GamePlay), quiz practice (PracticeAnswer) and games opened from the feed (FeedGamePlay). A Super Admin sees every player. Other staff
 * see this only while a Super Admin has shared the table AND switched them on (the GAME_RESULTS permission), and then only players in
 * their own courses.
 */
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { coursesWhere, requireGamingOps, type StudioSession } from "@/lib/quest/studioAccess";
import { itemTitle, type ItemContent, type ItemFormat } from "@/lib/quest/games";
import { mergePlayers, summarize, type PlayCount, type PlayerIdentity, type ResultFormat } from "@/lib/quest/resultsCore";

export class ResultsError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

export async function resultsShared(): Promise<boolean> {
  const row = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { gameResultsShared: true } }).catch(() => null);
  return row?.gameResultsShared === true;
}

/** Throws unless this person may open the Game results table: a Super Admin, or staff given "Game results: View" (not Studio access). */
export async function requireResultsViewer(): Promise<StudioSession> {
  return requireGamingOps("gaming_ops.results:view");
}

/** Modules whose players this person may see: all of them (null) for a Super Admin, their own courses' for everyone else. */
async function moduleScope(s: StudioSession, courseId?: string): Promise<string[] | null> {
  if ((s.isSuper || s.scopeAll) && !courseId) return null;
  const mods = await prisma.module.findMany({ where: { course: { ...(await coursesWhere(s)), ...(courseId ? { id: courseId } : {}) } }, select: { id: true }, take: 5000 });
  return mods.map((m) => m.id);
}

/** Who a signed-in person is, copied at play time so the table can name them whatever kind of account they have. */
export async function playerIdentity(session: Pick<SessionPayload, "userId" | "role">): Promise<PlayerIdentity> {
  const id = session.userId;
  const fallback = (kind: string): PlayerIdentity => ({ name: "Player", email: "", kind });
  switch (session.role) {
    case "TRAINEE": {
      const t = await prisma.trainee.findUnique({ where: { id }, select: { name: true, email: true } });
      return t ? { ...t, kind: "TRAINEE" } : fallback("TRAINEE");
    }
    case "EMPLOYER": {
      const e = await prisma.employer.findUnique({ where: { id }, select: { companyName: true, contactName: true, email: true } });
      return e ? { name: `${e.contactName} (${e.companyName})`, email: e.email, kind: "EMPLOYER" } : fallback("EMPLOYER");
    }
    case "INVESTOR": {
      const i = await prisma.investor.findUnique({ where: { id }, select: { name: true, email: true } });
      return i ? { ...i, kind: "INVESTOR" } : fallback("INVESTOR");
    }
    default: {
      const u = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
      return u ? { ...u, kind: "STAFF" } : fallback("STAFF");
    }
  }
}

/** Records one graded answer from a game opened on the feed. Never throws: a failed record must not break the game. */
export async function recordFeedPlay(entry: { session: Pick<SessionPayload, "userId" | "role">; assignmentId: string; gameId: string; moduleId: string; format: ResultFormat; itemId: string; correct: boolean; score: number }) {
  try {
    const who = await playerIdentity(entry.session);
    await prisma.feedGamePlay.create({
      data: { userId: entry.session.userId, kind: who.kind, name: who.name, email: who.email, assignmentId: entry.assignmentId, gameId: entry.gameId, moduleId: entry.moduleId, format: entry.format, itemId: entry.itemId, correct: entry.correct, score: entry.score },
    });
  } catch {
    // The player still gets their answer.
  }
}

export interface ResultsQuery {
  days: number | null;
  gameId: string | null;
  q: string;
}

const sinceOf = (days: number | null) => (days ? new Date(Date.now() - days * 86_400_000) : null);

/** Everything the table needs: filtered counts per player and game, merged into one row per player. */
export async function playerTable(s: StudioSession, query: ResultsQuery, opts: { courseId?: string; userIds?: Set<string> } = {}) {
  const modules = await moduleScope(s, opts.courseId);
  const since = sinceOf(query.days);
  const timeWhere = { answeredAt: { not: null as null | Date, ...(since ? { gte: since } : {}) } };
  const feedTime = since ? { answeredAt: { gte: since } } : {};
  const moduleWhere = modules ? { moduleId: { in: modules } } : {};

  const game = query.gameId ? await prisma.game.findUnique({ where: { id: query.gameId }, select: { id: true, format: true, assignments: { select: { moduleId: true } } } }) : null;
  const gameWhere = game ? { gameId: game.id } : {};
  const skipQuiz = !!game && game.format !== "QUIZ";
  const quizModules = game && game.format === "QUIZ" ? game.assignments.map((a) => a.moduleId) : null;
  const skipItems = !!game && game.format === "QUIZ";

  const [playAll, playOk, quizAll, quizOk, feedAll, feedOk] = await Promise.all([
    skipItems ? [] : prisma.gamePlay.groupBy({ by: ["traineeId", "gameId"], where: { ...timeWhere, ...moduleWhere, ...gameWhere }, _count: { _all: true }, _sum: { score: true }, _min: { answeredAt: true }, _max: { answeredAt: true } }),
    skipItems ? [] : prisma.gamePlay.groupBy({ by: ["traineeId", "gameId"], where: { ...timeWhere, ...moduleWhere, ...gameWhere, correct: true }, _count: { _all: true } }),
    skipQuiz ? [] : prisma.practiceAnswer.groupBy({ by: ["traineeId"], where: { ...timeWhere, ...moduleWhere, ...(quizModules ? { moduleId: { in: modules ? quizModules.filter((m) => modules.includes(m)) : quizModules } } : {}) }, _count: { _all: true }, _min: { answeredAt: true }, _max: { answeredAt: true } }),
    skipQuiz ? [] : prisma.practiceAnswer.groupBy({ by: ["traineeId"], where: { ...timeWhere, ...moduleWhere, correct: true, ...(quizModules ? { moduleId: { in: modules ? quizModules.filter((m) => modules.includes(m)) : quizModules } } : {}) }, _count: { _all: true } }),
    prisma.feedGamePlay.groupBy({ by: ["userId", "gameId", "format"], where: { ...feedTime, ...moduleWhere, ...gameWhere }, _count: { _all: true }, _sum: { score: true }, _min: { answeredAt: true }, _max: { answeredAt: true } }),
    prisma.feedGamePlay.groupBy({ by: ["userId", "gameId", "format"], where: { ...feedTime, ...moduleWhere, ...gameWhere, correct: true }, _count: { _all: true } }),
  ]);

  const gameIds = [...new Set(playAll.map((r) => r.gameId))];
  const formats = new Map((await prisma.game.findMany({ where: { id: { in: gameIds } }, select: { id: true, format: true } })).map((g) => [g.id, g.format as ResultFormat]));
  const counts: PlayCount[] = [];
  const okOf = <T extends { _count: { _all: number } }>(rows: T[], match: (r: T) => boolean) => rows.find(match)?._count._all ?? 0;
  for (const r of playAll) counts.push({ userId: r.traineeId, gameId: r.gameId, format: formats.get(r.gameId) ?? "MATCHING", source: "COURSE", answers: r._count._all, correct: okOf(playOk, (o) => o.traineeId === r.traineeId && o.gameId === r.gameId), scoreSum: r._sum.score ?? 0, first: r._min.answeredAt, last: r._max.answeredAt });
  for (const r of quizAll) {
    const good = okOf(quizOk, (o) => o.traineeId === r.traineeId);
    counts.push({ userId: r.traineeId, gameId: null, format: "QUIZ", source: "COURSE", answers: r._count._all, correct: good, scoreSum: good, first: r._min.answeredAt, last: r._max.answeredAt });
  }
  for (const r of feedAll) counts.push({ userId: r.userId, gameId: r.gameId, format: r.format as ResultFormat, source: "FEED", answers: r._count._all, correct: okOf(feedOk, (o) => o.userId === r.userId && o.gameId === r.gameId && o.format === r.format), scoreSum: r._sum.score ?? 0, first: r._min.answeredAt, last: r._max.answeredAt });

  // Names: trainees from their own table, everyone else from what was copied when they played.
  const ids = [...new Set(counts.map((c) => c.userId))];
  const identities = new Map<string, PlayerIdentity>();
  const trainees = await prisma.trainee.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  for (const t of trainees) identities.set(t.id, { name: t.name, email: t.email, kind: "TRAINEE" });
  const missing = ids.filter((i) => !identities.has(i));
  if (missing.length) {
    const copies = await prisma.feedGamePlay.findMany({ where: { userId: { in: missing } }, orderBy: { answeredAt: "desc" }, distinct: ["userId"], select: { userId: true, name: true, email: true, kind: true } });
    for (const c of copies) identities.set(c.userId, { name: c.name, email: c.email, kind: c.kind });
  }

  let rows = mergePlayers(counts, identities);
  // An organization sees only people enrolled in its own courses, even where a game on the feed is open to everyone.
  if (opts.userIds) rows = rows.filter((r) => opts.userIds!.has(r.userId));
  const q = query.q.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  return { players: rows.slice(0, 1000), summary: summarize(rows) };
}

/** The games a viewer can filter by: those with plays they may see. */
export async function gameOptions(s: StudioSession) {
  const modules = await moduleScope(s);
  const games = await prisma.game.findMany({
    where: { assignments: { some: modules ? { moduleId: { in: modules } } : {} } },
    orderBy: { title: "asc" },
    take: 200,
    select: { id: true, title: true, format: true },
  });
  return games;
}

export interface RecentPlay {
  at: Date;
  source: "COURSE" | "FEED";
  game: string;
  format: ResultFormat;
  what: string;
  correct: boolean;
  score: number;
}

/** One player's latest answers, newest first. Empty if the player has nothing in a module this viewer may see. */
export async function playerDetail(s: StudioSession, userId: string): Promise<RecentPlay[]> {
  const modules = await moduleScope(s);
  const moduleWhere = modules ? { moduleId: { in: modules } } : {};
  const [plays, quiz, feed] = await Promise.all([
    prisma.gamePlay.findMany({ where: { traineeId: userId, answeredAt: { not: null }, ...moduleWhere }, orderBy: { answeredAt: "desc" }, take: 40, select: { answeredAt: true, correct: true, score: true, game: { select: { title: true, format: true } }, item: { select: { format: true, content: true } } } }),
    prisma.practiceAnswer.findMany({ where: { traineeId: userId, answeredAt: { not: null }, ...moduleWhere }, orderBy: { answeredAt: "desc" }, take: 40, select: { answeredAt: true, correct: true, question: { select: { text: true } } } }),
    prisma.feedGamePlay.findMany({ where: { userId, ...moduleWhere }, orderBy: { answeredAt: "desc" }, take: 40 }),
  ]);
  const gameTitles = new Map((await prisma.game.findMany({ where: { id: { in: feed.map((f) => f.gameId) } }, select: { id: true, title: true } })).map((g) => [g.id, g.title]));
  const itemIds = feed.map((f) => f.itemId);
  const [items, questions] = await Promise.all([
    prisma.gameItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, format: true, content: true } }),
    prisma.question.findMany({ where: { id: { in: itemIds } }, select: { id: true, text: true } }),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const qMap = new Map(questions.map((q) => [q.id, q.text]));
  const clip = (t: string) => (t.length > 120 ? `${t.slice(0, 120)}…` : t);

  const out: RecentPlay[] = [];
  for (const p of plays) out.push({ at: p.answeredAt as Date, source: "COURSE", game: p.game.title, format: p.item.format as ResultFormat, what: clip(itemTitle(p.item.format as ItemFormat, p.item.content as unknown as ItemContent)), correct: p.correct === true, score: p.score ?? 0 });
  for (const p of quiz) out.push({ at: p.answeredAt as Date, source: "COURSE", game: "Quiz practice", format: "QUIZ", what: clip(p.question.text), correct: p.correct === true, score: p.correct ? 1 : 0 });
  for (const f of feed) {
    const it = itemMap.get(f.itemId);
    out.push({ at: f.answeredAt, source: "FEED", game: gameTitles.get(f.gameId) ?? "Removed game", format: f.format as ResultFormat, what: clip(it ? itemTitle(it.format as ItemFormat, it.content as unknown as ItemContent) : qMap.get(f.itemId) ?? "A question"), correct: f.correct, score: f.score });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60);
}

/** Staff a Super Admin can pick from, with whether each may open the table. */
export async function accessList() {
  const people = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "INSTRUCTOR"] } }, orderBy: { name: "asc" }, take: 300, select: { id: true, name: true, email: true, role: true, studioPermissions: true } });
  const { permissionsFrom } = await import("@/lib/quest/permissions");
  return people.map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, allowed: permissionsFrom(p.studioPermissions).includes("GAME_RESULTS") }));
}
