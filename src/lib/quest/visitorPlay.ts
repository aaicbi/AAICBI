/**
 * Try-a-game from the feed: anyone with an account (a trainee, founder, employer, organization, anyone signed in) can play a short round of a live game that staff have opened to visitors.
 * No XP is paid. Each graded answer is recorded (FeedGamePlay) so the Game results table can show how people do; it exists to give a taste of a course. Only what trainees already see is used: APPROVED game
 * items, and for quiz games the approved PRACTICE questions (the assessment pool is never served here). The answer key never leaves
 * the server, and every request is checked again against the live, open assignment, so switching a game off closes it at once.
 */
import { prisma } from "@/lib/prisma";
import { shuffle } from "@/lib/shuffle";
import { gradeItem, serveItem, type ItemContent, type ItemFormat } from "@/lib/quest/games";
import type { PlayServed } from "@/components/games/GamePlayer";
import type { SessionPayload } from "@/lib/auth/session";
import { recordFeedPlay } from "@/lib/quest/results";

export const VISITOR_ROUND_SIZE = 10;
/** A game needs at least this many things to play before it is shown to visitors. */
export const VISITOR_MIN_ITEMS = 10;

const openWhere = { live: true, openToVisitors: true, module: { course: { status: "PUBLISHED" as const } } };

const practiceWhere = (moduleId: string) => ({ exam: { moduleId }, bankStatus: "APPROVED" as const, bankPool: "PRACTICE" as const, bankObjectiveId: { not: null }, needsReview: false });

export class VisitorPlayError extends Error {
  constructor(message: string, public status = 404) {
    super(message);
  }
}

async function openAssignment(id: string) {
  const a = await prisma.gameAssignment.findFirst({
    where: { id, ...openWhere },
    select: { id: true, moduleId: true, game: { select: { id: true, title: true, format: true, description: true } }, module: { select: { title: true, courseId: true, course: { select: { id: true, title: true } } } } },
  });
  if (!a) throw new VisitorPlayError("This game isn't open to visitors right now.");
  return a;
}

export async function available(a: { moduleId: string; game: { format: string } }): Promise<number> {
  if (a.game.format === "QUIZ") return prisma.question.count({ where: practiceWhere(a.moduleId) });
  return prisma.gameItem.count({ where: { moduleId: a.moduleId, format: a.game.format as ItemFormat, status: "APPROVED" } });
}

export interface VisitorGame {
  id: string;
  title: string;
  format: string;
  description: string | null;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
}

/** The games to show visitors: live, switched open, in a published course, with enough to play. */
export async function visitorGames(limit = 8): Promise<VisitorGame[]> {
  const rows = await prisma.gameAssignment.findMany({
    where: openWhere,
    orderBy: { createdAt: "asc" },
    take: 40,
    select: { id: true, moduleId: true, game: { select: { title: true, format: true, description: true } }, module: { select: { title: true, course: { select: { id: true, title: true } } } } },
  });
  const out: VisitorGame[] = [];
  for (const r of rows) {
    if (out.length >= limit) break;
    if ((await available(r)) < VISITOR_MIN_ITEMS) continue;
    out.push({ id: r.id, title: r.game.title, format: r.game.format, description: r.game.description, moduleTitle: r.module.title, courseId: r.module.course.id, courseTitle: r.module.course.title });
  }
  return out;
}

export async function visitorGame(id: string): Promise<VisitorGame | null> {
  try {
    const a = await openAssignment(id);
    if ((await available(a)) < VISITOR_MIN_ITEMS) return null;
    return { id: a.id, title: a.game.title, format: a.game.format, description: a.game.description, moduleTitle: a.module.title, courseId: a.module.courseId, courseTitle: a.module.course.title };
  } catch {
    return null;
  }
}

/** Serves one random item the visitor has not seen in this round (`seen` is kept by their browser). Null when the round is over. */
export async function visitorNext(assignmentId: string, seen: string[]) {
  const a = await openAssignment(assignmentId);
  const done = new Set(seen.slice(0, 60));
  if (done.size >= VISITOR_ROUND_SIZE) return null;

  if (a.game.format === "QUIZ") {
    const qs = await prisma.question.findMany({
      where: practiceWhere(a.moduleId),
      select: { id: true, text: true, bankObjective: { select: { text: true } }, options: { select: { key: true, text: true, isCorrect: true }, orderBy: { order: "asc" } } },
    });
    const usable = qs.filter((q) => !done.has(q.id) && q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length === 1);
    if (usable.length === 0) return null;
    const q = usable[Math.floor(Math.random() * usable.length)];
    const served: PlayServed = { format: "QUIZ", question: q.text, options: shuffle(q.options.map((o) => ({ key: o.key, text: o.text }))) };
    return { itemId: q.id, format: "QUIZ" as const, objective: q.bankObjective?.text ?? a.module.title, served };
  }

  const format = a.game.format as ItemFormat;
  const items = await prisma.gameItem.findMany({ where: { moduleId: a.moduleId, format, status: "APPROVED" }, select: { id: true, content: true, objective: { select: { text: true } } } });
  const fresh = items.filter((i) => !done.has(i.id));
  if (fresh.length === 0) return null;
  const it = fresh[Math.floor(Math.random() * fresh.length)];
  return { itemId: it.id, format, objective: it.objective.text, served: serveItem(format, it.content as unknown as ItemContent) };
}

/** Grades one answer and returns the feedback (this is where the key is revealed). Nothing is stored. */
export async function visitorAnswer(assignmentId: string, itemId: string, response: unknown, who: Pick<SessionPayload, "userId" | "role">) {
  const a = await openAssignment(assignmentId);
  if (a.game.format === "QUIZ") {
    const q = await prisma.question.findFirst({ where: { id: itemId, ...practiceWhere(a.moduleId) }, select: { explanation: true, options: { select: { key: true, isCorrect: true } } } });
    if (!q) throw new VisitorPlayError("That question isn't available.");
    const choice = (response as { choice?: unknown } | null)?.choice;
    if (typeof choice !== "string" || !q.options.some((o) => o.key === choice)) throw new VisitorPlayError("Choose one of the options.", 400);
    const correctKey = q.options.find((o) => o.isCorrect)?.key ?? null;
    const ok = choice === correctKey;
    await recordFeedPlay({ session: who, assignmentId, gameId: a.game.id, moduleId: a.moduleId, format: "QUIZ", itemId, correct: ok, score: ok ? 1 : 0 });
    return { score: ok ? 1 : 0, correct: ok, feedback: { correctOptionKey: correctKey, explanation: q.explanation } };
  }
  const format = a.game.format as ItemFormat;
  const item = await prisma.gameItem.findFirst({ where: { id: itemId, moduleId: a.moduleId, format, status: "APPROVED" }, select: { content: true } });
  if (!item) throw new VisitorPlayError("That item isn't available.");
  const graded = gradeItem(format, item.content as unknown as ItemContent, response);
  if (!graded) throw new VisitorPlayError("Finish your answer first.", 400);
  await recordFeedPlay({ session: who, assignmentId, gameId: a.game.id, moduleId: a.moduleId, format, itemId, correct: graded.correct, score: graded.score });
  return graded;
}

/** Why an assignment is (not) on the feed, in plain words, for the studio. Null when nothing is in the way. */
export async function feedBlocker(a: { moduleId: string; live: boolean; openToVisitors: boolean; game: { format: string } }): Promise<string | null> {
  if (!a.openToVisitors) return null;
  if (!a.live) return "Not shown: the game is not live.";
  const mod = await prisma.module.findUnique({ where: { id: a.moduleId }, select: { course: { select: { status: true } } } });
  if (mod?.course.status !== "PUBLISHED") return "Not shown yet: the course is not published (it is " + (mod?.course.status ?? "missing").toLowerCase() + ").";
  const n = await available(a);
  if (n < VISITOR_MIN_ITEMS) return `Not shown yet: it needs at least ${VISITOR_MIN_ITEMS} approved ${a.game.format === "QUIZ" ? "practice questions" : "items"} and has ${n}.`;
  return null;
}
