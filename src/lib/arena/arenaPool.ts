/**
 * Gaming Arena: where the questions come from. Only what trainees already see in practice: approved practice questions and
 * approved game items of the course (the assessment pool is never used). The answer key stays here on the server: what players
 * get is the "served" shape (shuffled once, no key), and the key only appears in the reveal after the round is over.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shuffle } from "@/lib/shuffle";
import { gradeItem, serveItem, type ItemContent, type ItemFormat, type MatchingContent, type OrderingContent, type ScenarioContent } from "@/lib/quest/games";
import { BASE_POINTS, type ArenaFormat } from "@/lib/arena/arenaCore";

export interface PoolEntry { kind: "QUESTION" | "ITEM"; id: string; format: ArenaFormat }

export type ServedRound = { topic: string; level: "Easy" | "Medium" | "Hard" } & (
  | { format: "QUIZ"; question: string; options: { key: string; text: string }[] }
  | { format: "MATCHING"; prompt: string; lefts: string[]; rights: string[] }
  | { format: "ORDERING"; prompt: string; steps: string[] }
  | { format: "SCENARIO"; situation: string; options: string[] }
);

export interface Reveal {
  format: ArenaFormat;
  explanation: string | null;
  /** Quiz: the right option. */
  correctKey?: string;
  correctText?: string;
  /** Matching: the right pairs. */
  pairs?: { left: string; right: string }[];
  /** Ordering: the right order. */
  correctOrder?: string[];
  /** Scenario: the best choice and what happens. */
  best?: string;
  bestOutcome?: string;
}

const questionWhere = (courseId: string, moduleId: string | null): Prisma.QuestionWhereInput => ({
  exam: moduleId ? { moduleId } : { courseModule: { courseId } },
  bankStatus: "APPROVED",
  bankPool: "PRACTICE",
  bankObjectiveId: { not: null },
  needsReview: false,
});

const LEVEL = { BEGINNER: "Easy", INTERMEDIATE: "Medium", ADVANCED: "Hard" } as const;

/** Every playable thing for a course (or one module of it) as a light list of ids. */
export async function poolFor(courseId: string, moduleId: string | null): Promise<PoolEntry[]> {
  const [qs, items] = await Promise.all([
    prisma.question.findMany({ where: questionWhere(courseId, moduleId), select: { id: true, options: { select: { isCorrect: true } } } }),
    prisma.gameItem.findMany({ where: { status: "APPROVED", ...(moduleId ? { moduleId } : { module: { courseId } }) }, select: { id: true, format: true } }),
  ]);
  const out: PoolEntry[] = [];
  for (const q of qs) if (q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length === 1) out.push({ kind: "QUESTION", id: q.id, format: "QUIZ" });
  for (const i of items) out.push({ kind: "ITEM", id: i.id, format: i.format as ArenaFormat });
  return out;
}

/** Modules of a course that have enough to play, for the topic choice. */
export async function modulesWithPool(courseId: string, minimum: number): Promise<{ id: string; title: string; count: number }[]> {
  const mods = await prisma.module.findMany({ where: { courseId }, orderBy: { order: "asc" }, select: { id: true, title: true } });
  const out: { id: string; title: string; count: number }[] = [];
  for (const m of mods) {
    const count = (await poolFor(courseId, m.id)).length;
    if (count >= minimum) out.push({ ...m, count });
  }
  return out;
}

export const basePointsFor = (e: PoolEntry) => BASE_POINTS[e.format];

/** Picks one at random that hasn't been used in this match. Null if the pool has run dry. */
export function chooseEntry(pool: PoolEntry[], used: Set<string>, rand: () => number = Math.random): PoolEntry | null {
  const fresh = pool.filter((e) => !used.has(e.id));
  return fresh.length ? fresh[Math.floor(rand() * fresh.length)] : null;
}

/** What players see for an entry: shuffled once, with no key. */
export async function serveEntry(e: PoolEntry): Promise<ServedRound | null> {
  if (e.kind === "QUESTION") {
    const q = await prisma.question.findUnique({ where: { id: e.id }, select: { text: true, difficulty: true, bankObjective: { select: { text: true } }, exam: { select: { courseModule: { select: { title: true } } } }, options: { select: { key: true, text: true }, orderBy: { order: "asc" } } } });
    if (!q) return null;
    return { format: "QUIZ", topic: q.bankObjective?.text ?? q.exam.courseModule?.title ?? "Course question", level: q.difficulty ? LEVEL[q.difficulty as keyof typeof LEVEL] ?? "Medium" : "Medium", question: q.text, options: shuffle(q.options) };
  }
  const it = await prisma.gameItem.findUnique({ where: { id: e.id }, select: { format: true, content: true, objective: { select: { text: true } }, module: { select: { title: true } } } });
  if (!it) return null;
  const served = serveItem(it.format as ItemFormat, it.content as unknown as ItemContent);
  return { ...served, topic: it.objective?.text ?? it.module.title, level: "Medium" } as ServedRound;
}

/** Grades a player's response. null means the response was not in the right shape. */
export async function gradeEntry(e: PoolEntry, response: unknown): Promise<{ correct: boolean } | null> {
  if (e.kind === "QUESTION") {
    const q = await prisma.question.findUnique({ where: { id: e.id }, select: { options: { select: { key: true, isCorrect: true } } } });
    const choice = (response as { choice?: unknown } | null)?.choice;
    if (!q || typeof choice !== "string" || !q.options.some((o) => o.key === choice)) return null;
    return { correct: q.options.find((o) => o.isCorrect)?.key === choice };
  }
  const it = await prisma.gameItem.findUnique({ where: { id: e.id }, select: { format: true, content: true } });
  if (!it) return null;
  const g = gradeItem(it.format as ItemFormat, it.content as unknown as ItemContent, response);
  return g ? { correct: g.correct } : null;
}

/** The answer and the explanation, shown to both players once the round is over. */
export async function revealEntry(e: PoolEntry): Promise<Reveal> {
  if (e.kind === "QUESTION") {
    const q = await prisma.question.findUnique({ where: { id: e.id }, select: { explanation: true, options: { select: { key: true, text: true, isCorrect: true } } } });
    const right = q?.options.find((o) => o.isCorrect);
    return { format: "QUIZ", explanation: q?.explanation ?? null, correctKey: right?.key, correctText: right?.text };
  }
  const it = await prisma.gameItem.findUnique({ where: { id: e.id }, select: { format: true, content: true } });
  if (!it) return { format: e.format, explanation: null };
  if (it.format === "MATCHING") return { format: "MATCHING", explanation: null, pairs: (it.content as unknown as MatchingContent).pairs };
  if (it.format === "ORDERING") return { format: "ORDERING", explanation: null, correctOrder: (it.content as unknown as OrderingContent).steps };
  const c = it.content as unknown as ScenarioContent;
  const best = c.options.find((o) => o.correct)!;
  return { format: "SCENARIO", explanation: null, best: best.text, bestOutcome: best.outcome };
}
