/**
 * Gaming Arena: what a player is allowed to see. The browser never receives the answer key, the other player's wrong answer, or the
 * question while the game is paused; it gets this view, rebuilt on the server for each player, every time something changes.
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse, resolveForCourse } from "@/lib/arena/config";
import { type ArenaRules } from "@/lib/arena/configCore";
import { STEAL_MS, boardSize, isPlayer, reactionsOpen, rulesFrom, stealPoints, type MatchStatus, type Phase } from "@/lib/arena/arenaCore";
import { ONLINE_SECONDS, ArenaError, mutate } from "@/lib/arena/arena";
import { modulesWithPool, type Reveal, type ServedRound } from "@/lib/arena/arenaPool";

export interface PlayerView { id: string; name: string; initials: string; avatarUrl: string | null; score: number; pausesLeft: number; ready: boolean }

export interface MatchView {
  id: string;
  status: MatchStatus;
  courseId: string;
  courseTitle: string;
  topic: string | null;
  serverNow: number;
  rules: ArenaRules;
  me: PlayerView;
  opponent: PlayerView;
  youAre: "challenger" | "opponent";
  phase: Phase | null;
  phaseEndsAt: number | null;
  paused: { by: "me" | "opponent"; resumesAt: number } | null;
  turn: "me" | "opponent" | null;
  roundNo: number;
  totalRounds: number;
  /** Numbers already played, and who took the points for each ("none" when nobody did). */
  board: { size: number; used: number[]; owners: Record<number, "me" | "opponent" | "none"> };
  round: null | {
    idx: number;
    number: number;
    format: string;
    points: number;
    bonusPoints: number;
    stage: "ANSWER" | "STEAL" | "REVEAL";
    /** Who is answering right now. */
    answerer: "me" | "opponent";
    iCanAnswer: boolean;
    served: ServedRound | null;
  };
  reveal: null | { outcome: "FIRST" | "STOLEN" | "NONE"; awardedTo: "me" | "opponent" | null; points: number; answer: Reveal };
  /** One dot per round for the progress bar: won (by you), lost (the other player got it, or nobody did), or still to play. */
  progress: ("won" | "lost" | "none" | "now" | "todo")[];
  messages: { id: string; from: "me" | "opponent"; body: string; at: number }[];
  reactions: { id: string; from: "me" | "opponent"; kind: string; at: number }[];
  reactionsOpen: boolean;
  ready: { me: boolean; opponent: boolean };
  expiresAt: number;
  /** Answers in a row, per player, for the flame badge. */
  streak: { me: number; opponent: number };
  /** After a match: a rematch someone has asked for (or that is already in its lobby). */
  rematch: null | { id: string; status: MatchStatus; from: "me" | "opponent" };
  result: null | {
    winner: "me" | "opponent" | "draw";
    reason: string | null;
    myScore: number;
    opponentScore: number;
    answered: number;
    correct: number;
    bestStreak: number;
    stars: 1 | 2 | 3;
    topics: { topic: string; correct: number; total: number }[];
    /** Every question with the answer and the reason, for learning from the match. */
    recap: { topic: string; prompt: string; answer: string; explanation: string | null; mine: "correct" | "missed" | "skipped"; winner: "me" | "opponent" | null }[];
    /** Wins, losses and draws between these two players in this course. */
    record: { wins: number; losses: number; draws: number };
  };
}

const promptOf = (s: ServedRound): string => (s.format === "QUIZ" ? s.question : s.format === "SCENARIO" ? s.situation : s.prompt);

function answerText(r: Reveal): string {
  if (r.format === "QUIZ") return r.correctText ?? "";
  if (r.format === "MATCHING") return (r.pairs ?? []).map((p) => `${p.left} → ${p.right}`).join("; ");
  if (r.format === "ORDERING") return (r.correctOrder ?? []).map((t, i) => `${i + 1}. ${t}`).join("  ");
  return r.best ?? "";
}

function explanationOf(r: Reveal): string | null {
  return r.format === "SCENARIO" ? r.bestOutcome ?? null : r.explanation;
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** The match as one player may see it. Time-based progress is applied first, so this is always current. */
export async function viewMatch(matchId: string, viewerId: string): Promise<MatchView> {
  const { match: m, rounds } = await mutate(matchId);
  if (!isPlayer(m, viewerId)) throw new ArenaError("That match could not be found.", 404);
  const [challenger, opponent, course, mod, messages, reactions] = await Promise.all([
    prisma.trainee.findUnique({ where: { id: m.challengerId }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.trainee.findUnique({ where: { id: m.opponentId }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.course.findUnique({ where: { id: m.courseId }, select: { title: true } }),
    m.moduleId ? prisma.module.findUnique({ where: { id: m.moduleId }, select: { title: true } }) : null,
    prisma.arenaMessage.findMany({ where: { matchId }, orderBy: { createdAt: "asc" }, take: 40 }),
    prisma.arenaReaction.findMany({ where: { matchId, createdAt: { gte: new Date(Date.now() - 20_000) } }, orderBy: { createdAt: "asc" }, take: 30 }),
  ]);
  const rules = rulesFrom(m.rules);
  const iAmChallenger = viewerId === m.challengerId;
  const side = (id: string): "me" | "opponent" => (id === viewerId ? "me" : "opponent");
  const player = (t: { id: string; name: string; avatarUrl: string | null } | null, challenger: boolean): PlayerView => ({
    id: t?.id ?? "", name: t?.name ?? "Player", initials: initialsOf(t?.name ?? ""), avatarUrl: t?.avatarUrl ?? null,
    score: challenger ? m.scoreChallenger : m.scoreOpponent,
    pausesLeft: Math.max(0, rules.pausesPerPlayer - (challenger ? m.pausesUsedChallenger : m.pausesUsedOpponent)),
    ready: challenger ? m.readyChallenger : m.readyOpponent,
  });
  const me = player(iAmChallenger ? challenger : opponent, iAmChallenger);
  const opp = player(iAmChallenger ? opponent : challenger, !iAmChallenger);
  const paused = m.pausedById !== null;
  const cur = rounds.length ? rounds[rounds.length - 1] : null;
  const live = m.status === "ACTIVE" && cur && (m.phase === "ANSWER" || m.phase === "STEAL" || m.phase === "REVEAL");

  let round: MatchView["round"] = null;
  if (live && cur) {
    const stage = m.phase as "ANSWER" | "STEAL" | "REVEAL";
    const answererId = stage === "STEAL" ? cur.stealerId ?? "" : cur.pickerId;
    round = {
      idx: cur.idx, number: cur.number, format: cur.format, points: cur.basePoints, bonusPoints: stealPoints(cur.basePoints, rules.bonusPercent), stage,
      answerer: side(answererId), iCanAnswer: !paused && stage !== "REVEAL" && answererId === viewerId,
      // The question is hidden while paused, so nobody can look things up.
      served: paused && stage !== "REVEAL" ? null : (cur.served as unknown as ServedRound),
    };
  }
  const reveal: MatchView["reveal"] = live && cur && m.phase === "REVEAL" && cur.outcome
    ? { outcome: cur.outcome as "FIRST" | "STOLEN" | "NONE", awardedTo: cur.awardedToId ? side(cur.awardedToId) : null, points: cur.points, answer: cur.reveal as unknown as Reveal }
    : null;

  const progress: MatchView["progress"] = Array.from({ length: rules.questionsPerMatch }, (_, i) => {
    const r = rounds[i];
    if (!r) return "todo";
    if (i === rounds.length - 1 && m.status === "ACTIVE" && m.phase !== "REVEAL") return "now";
    return r.awardedToId === viewerId ? "won" : r.outcome ? "lost" : "now";
  });

  // Answers in a row, in the order they happened.
  const streaks = { me: 0, opponent: 0, bestMe: 0 };
  for (const r of rounds) {
    const results: [string, boolean][] = [];
    if (r.firstAt && !r.firstTimedOut) results.push([r.pickerId, r.firstCorrect === true]); else if (r.firstTimedOut) results.push([r.pickerId, false]);
    if (r.stealerId) results.push([r.stealerId, r.stealCorrect === true && !r.stealTimedOut]);
    for (const [who, ok] of results) {
      const k = side(who);
      streaks[k] = ok ? streaks[k] + 1 : 0;
      if (k === "me") streaks.bestMe = Math.max(streaks.bestMe, streaks.me);
    }
  }
  const over = m.status === "COMPLETED" || m.status === "FORFEITED";
  const rematchRow = over ? await prisma.arenaMatch.findFirst({ where: { rematchOfId: m.id, status: { in: ["PENDING", "LOBBY", "ACTIVE"] } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, challengerId: true } }) : null;

  let result: MatchView["result"] = null;
  if (over) {
    let answered = 0; let correct = 0; const topics = new Map<string, { correct: number; total: number }>();
    const recap: NonNullable<MatchView["result"]>["recap"] = [];
    for (const r of rounds) {
      const served = r.served as unknown as ServedRound;
      const reveal = r.reveal as unknown as Reveal | null;
      if (reveal) {
        const tried = r.pickerId === viewerId ? (r.firstAt !== null && !r.firstTimedOut ? (r.firstCorrect ? "correct" : "missed") : "skipped") : r.stealerId === viewerId ? (r.stealAt !== null && !r.stealTimedOut ? (r.stealCorrect ? "correct" : "missed") : "skipped") : "skipped";
        recap.push({ topic: served.topic, prompt: promptOf(served), answer: answerText(reveal), explanation: explanationOf(reveal), mine: tried, winner: r.awardedToId ? side(r.awardedToId) : null });
      }
      const mine = r.pickerId === viewerId ? { answered: !r.firstTimedOut && r.firstAt !== null, ok: r.firstCorrect === true } : r.stealerId === viewerId ? { answered: !r.stealTimedOut && r.stealAt !== null, ok: r.stealCorrect === true } : null;
      if (!mine || !mine.answered) continue;
      answered++; if (mine.ok) correct++;
      const topic = (r.served as unknown as ServedRound).topic;
      const t = topics.get(topic) ?? { correct: 0, total: 0 };
      t.total++; if (mine.ok) t.correct++;
      topics.set(topic, t);
    }
    const history = await prisma.arenaMatch.findMany({
      where: { courseId: m.courseId, status: { in: ["COMPLETED", "FORFEITED"] }, OR: [{ challengerId: m.challengerId, opponentId: m.opponentId }, { challengerId: m.opponentId, opponentId: m.challengerId }] },
      select: { winnerId: true }, take: 200,
    });
    const record = { wins: history.filter((h) => h.winnerId === viewerId).length, losses: history.filter((h) => h.winnerId && h.winnerId !== viewerId).length, draws: history.filter((h) => !h.winnerId).length };
    const accuracy = answered ? correct / answered : 0;
    result = {
      winner: m.winnerId === null ? "draw" : side(m.winnerId), reason: m.endReason, myScore: me.score, opponentScore: opp.score, answered, correct,
      bestStreak: streaks.bestMe, stars: accuracy >= 0.8 ? 3 : accuracy >= 0.5 ? 2 : 1, recap, record,
      topics: Array.from(topics, ([topic, v]) => ({ topic, ...v })).sort((a, b) => a.correct / a.total - b.correct / b.total),
    };
  }

  return {
    id: m.id, status: m.status, courseId: m.courseId, courseTitle: course?.title ?? "Course", topic: mod?.title ?? null, serverNow: Date.now(), rules, me, opponent: opp,
    youAre: iAmChallenger ? "challenger" : "opponent", phase: m.phase, phaseEndsAt: m.phaseEndsAt ? m.phaseEndsAt.getTime() : null,
    paused: paused ? { by: side(m.pausedById!), resumesAt: (m.pausedAt?.getTime() ?? Date.now()) + rules.pauseSeconds * 1000 } : null,
    turn: m.turnId ? side(m.turnId) : null, roundNo: m.roundNo, totalRounds: rules.questionsPerMatch,
    board: { size: boardSize(rules.questionsPerMatch), used: rounds.map((r) => r.number), owners: Object.fromEntries(rounds.filter((r) => r.outcome).map((r) => [r.number, r.awardedToId ? side(r.awardedToId) : "none"])) },
    round, reveal, progress, streak: { me: streaks.me, opponent: streaks.opponent },
    rematch: rematchRow ? { id: rematchRow.id, status: rematchRow.status as MatchStatus, from: side(rematchRow.challengerId) } : null,
    messages: messages.map((x) => ({ id: x.id, from: side(x.senderId), body: x.body, at: x.createdAt.getTime() })),
    reactions: reactions.map((x) => ({ id: x.id, from: side(x.senderId), kind: x.kind, at: x.createdAt.getTime() })),
    reactionsOpen: reactionsOpen(m.status, m.phase, paused),
    ready: { me: me.ready, opponent: opp.ready }, expiresAt: m.expiresAt.getTime(), result,
  };
}

/* ------------------------------------------------------------------ */
/* The course arena (the page where you find someone to play)          */
/* ------------------------------------------------------------------ */

export interface CourseArenaView {
  course: { id: string; title: string };
  me: { id: string; name: string };
  rules: ArenaRules;
  online: { id: string; name: string; initials: string; avatarUrl: string | null; status: "AVAILABLE" | "BUSY" }[];
  incoming: { id: string; from: { id: string; name: string; initials: string }; topic: string | null; expiresAt: number }[];
  outgoing: { id: string; to: { id: string; name: string }; topic: string | null; expiresAt: number }[];
  active: { id: string; status: MatchStatus; opponentName: string } | null;
  recent: { id: string; opponentName: string; result: "won" | "lost" | "draw" | "forfeit"; myScore: number; opponentScore: number; endedAt: number }[];
  topics: { id: string; title: string; count: number }[];
  serverNow: number;
}

export async function courseArenaView(traineeId: string, courseId: string): Promise<CourseArenaView> {
  const avail = await availabilityForCourse(courseId);
  if (!avail.game) throw new ArenaError("The Gaming Arena isn't open for this course right now.", 403);
  const rules = rulesFrom(await resolveForCourse(courseId));
  const [course, me, present, matches, recent, topics] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    prisma.trainee.findUnique({ where: { id: traineeId }, select: { id: true, name: true } }),
    prisma.arenaPresence.findMany({ where: { courseId, lastSeenAt: { gte: new Date(Date.now() - ONLINE_SECONDS * 1000) }, traineeId: { not: traineeId } }, include: { trainee: { select: { id: true, name: true, avatarUrl: true } } }, take: 60 }),
    prisma.arenaMatch.findMany({ where: { status: { in: ["PENDING", "LOBBY", "ACTIVE"] }, OR: [{ challengerId: traineeId }, { opponentId: traineeId }, { courseId }] }, include: { challenger: { select: { id: true, name: true } }, opponent: { select: { id: true, name: true } } } }),
    prisma.arenaMatch.findMany({ where: { courseId, status: { in: ["COMPLETED", "FORFEITED"] }, OR: [{ challengerId: traineeId }, { opponentId: traineeId }] }, orderBy: { endedAt: "desc" }, take: 5, include: { challenger: { select: { id: true, name: true } }, opponent: { select: { id: true, name: true } } } }),
    modulesWithPool(courseId, rules.questionsPerMatch),
  ]);
  if (!course || !me) throw new ArenaError("That course could not be found.", 404);
  const busyIds = new Set(matches.flatMap((x) => [x.challengerId, x.opponentId]));
  const topicTitle = async (moduleId: string | null) => (moduleId ? topics.find((t) => t.id === moduleId)?.title ?? null : null);
  const mine = matches.filter((x) => x.challengerId === traineeId || x.opponentId === traineeId);
  const incoming = await Promise.all(mine.filter((x) => x.status === "PENDING" && x.opponentId === traineeId).map(async (x) => ({ id: x.id, from: { id: x.challenger.id, name: x.challenger.name, initials: initialsOf(x.challenger.name) }, topic: await topicTitle(x.moduleId), expiresAt: x.expiresAt.getTime() })));
  const outgoing = await Promise.all(mine.filter((x) => x.status === "PENDING" && x.challengerId === traineeId).map(async (x) => ({ id: x.id, to: { id: x.opponent.id, name: x.opponent.name }, topic: await topicTitle(x.moduleId), expiresAt: x.expiresAt.getTime() })));
  const act = mine.find((x) => x.status === "LOBBY" || x.status === "ACTIVE");
  return {
    course, me, rules,
    online: present.map((p) => ({ id: p.trainee.id, name: p.trainee.name, initials: initialsOf(p.trainee.name), avatarUrl: p.trainee.avatarUrl, status: busyIds.has(p.trainee.id) ? ("BUSY" as const) : ("AVAILABLE" as const) })),
    incoming, outgoing,
    active: act ? { id: act.id, status: act.status as MatchStatus, opponentName: act.challengerId === traineeId ? act.opponent.name : act.challenger.name } : null,
    recent: recent.map((x) => {
      const iAmC = x.challengerId === traineeId;
      const my = iAmC ? x.scoreChallenger : x.scoreOpponent; const their = iAmC ? x.scoreOpponent : x.scoreChallenger;
      const forfeit = x.status === "FORFEITED" && x.winnerId !== traineeId;
      return { id: x.id, opponentName: iAmC ? x.opponent.name : x.challenger.name, result: x.winnerId === null ? ("draw" as const) : x.winnerId === traineeId ? ("won" as const) : forfeit ? ("forfeit" as const) : ("lost" as const), myScore: my, opponentScore: their, endedAt: (x.endedAt ?? x.createdAt).getTime() };
    }),
    topics, serverNow: Date.now(),
  };
}

export { STEAL_MS };
