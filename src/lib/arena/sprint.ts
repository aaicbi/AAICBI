/**
 * Ayakbi Arena: Fastest Fingers. An instructor posts a multiple-choice question in a course's chat; the first trainee to pick the
 * right option wins credit scores. One try each, so a guess costs the chance. The server decides the winner with one atomic update,
 * and the answer key never reaches a browser until the question is closed.
 */
import { prisma } from "@/lib/prisma";
import { availabilityForCourse } from "@/lib/arena/config";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { activeSuspension, suspensionText } from "@/lib/arena/suspension";
import { awardCredits } from "@/lib/arena/credits";
import { cleanOptionText } from "@/lib/arena/arenaPool";
import { channels } from "@/lib/arena/realtimeCore";
import { pokeMany } from "@/lib/arena/realtime";
import { pushToCourse } from "@/lib/arena/chatPush";

export const SPRINT_POINTS = { min: 1, max: 100, default: 10 } as const;

export interface SprintView {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  points: number;
  open: boolean;
  winnerName: string | null;
  /** What this viewer picked, if they have answered. */
  mine: { choice: string; correct: boolean } | null;
  /** Only once closed. */
  correctKey: string | null;
  explanation: string | null;
}

type Opt = { key: string; text: string };
const KEYS = ["A", "B", "C", "D", "E", "F"];

export async function sprintViews(ids: string[], viewerId: string): Promise<Map<string, SprintView>> {
  const rows = await prisma.arenaSprint.findMany({ where: { id: { in: ids } }, include: { winner: { select: { name: true } }, answers: { where: { traineeId: viewerId }, select: { choice: true, correct: true } } } });
  return new Map(rows.map((r) => {
    const open = r.status === "OPEN";
    return [r.id, { id: r.id, question: r.questionText, options: r.options as Opt[], points: r.points, open, winnerName: r.winner?.name ?? null, mine: r.answers[0] ?? null, correctKey: open ? null : r.correctKey, explanation: open ? null : r.explanation }];
  }));
}

/** Approved practice questions of the course an instructor can pick from, optionally narrowed by a few words. */
export async function sprintPool(courseId: string, q: string | null) {
  const rows = await prisma.question.findMany({
    where: { exam: { courseModule: { courseId } }, bankStatus: "APPROVED", bankPool: "PRACTICE", needsReview: false, ...(q ? { text: { contains: q, mode: "insensitive" } } : {}) },
    select: { id: true, text: true, exam: { select: { courseModule: { select: { title: true } } } }, options: { select: { key: true, isCorrect: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return rows.filter((r) => r.options.length >= 2 && r.options.length <= 6 && r.options.filter((o) => o.isCorrect).length === 1).map((r) => ({ id: r.id, text: r.text, module: r.exam.courseModule?.title ?? "" }));
}

export interface StartSprintInput {
  points?: number;
  explanation?: string | null;
  questionId?: string;
  custom?: { text: string; options: string[]; correctIndex: number };
}

export async function startSprint(courseId: string, staffId: string, input: StartSprintInput) {
  if (!(await availabilityForCourse(courseId)).fastest) throw new ArenaError("Fastest Fingers isn't switched on for this course.", 403);
  const points = Math.min(SPRINT_POINTS.max, Math.max(SPRINT_POINTS.min, Math.round(input.points ?? SPRINT_POINTS.default)));
  let text: string; let options: Opt[]; let correctKey: string; let explanation = input.explanation?.trim().slice(0, 500) || null; let sourceQuestionId: string | null = null;
  if (input.questionId) {
    const q = await prisma.question.findFirst({ where: { id: input.questionId, exam: { courseModule: { courseId } }, bankStatus: "APPROVED" }, select: { id: true, text: true, explanation: true, options: { select: { key: true, text: true, isCorrect: true }, orderBy: { key: "asc" } } } });
    if (!q || q.options.length < 2 || q.options.filter((o) => o.isCorrect).length !== 1) throw new ArenaError("That question can't be used here.", 404);
    text = q.text; sourceQuestionId = q.id;
    options = q.options.map((o, i) => ({ key: KEYS[i], text: cleanOptionText(o.text) }));
    correctKey = KEYS[q.options.findIndex((o) => o.isCorrect)];
    explanation = explanation ?? (q.explanation?.slice(0, 500) || null);
  } else if (input.custom) {
    const opts = input.custom.options.map((o) => o.trim()).filter(Boolean);
    if (!input.custom.text.trim() || opts.length < 2 || opts.length > 6 || input.custom.correctIndex < 0 || input.custom.correctIndex >= opts.length) throw new ArenaError("A question needs its text, 2 to 6 answers and one right answer.");
    text = input.custom.text.trim().slice(0, 500);
    options = opts.map((o, i) => ({ key: KEYS[i], text: o.slice(0, 200) }));
    correctKey = KEYS[input.custom.correctIndex];
  } else throw new ArenaError("Pick a question or write one.");

  // Only one question is live at a time: starting a new one closes the old.
  await prisma.arenaSprint.updateMany({ where: { courseId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
  const sprint = await prisma.arenaSprint.create({ data: { courseId, createdById: staffId, questionText: text, options, correctKey, explanation, sourceQuestionId, points } });
  await prisma.arenaChatMessage.create({ data: { courseId, senderId: null, kind: "FASTEST", refId: sprint.id, body: `Fastest Fingers: ${text}` } });
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
  void pushToCourse(courseId, null, { title: "⚡ Fastest Fingers", body: `First right answer wins ${points} credits: ${text}` });
  return sprint;
}

export async function answerSprint(traineeId: string, courseId: string, sprintId: string, choice: unknown): Promise<{ correct: boolean; won: boolean; late: boolean }> {
  if (!(await availabilityForCourse(courseId)).fastest) throw new ArenaError("Fastest Fingers isn't open right now.", 403);
  if (!(await isEnrolled(traineeId, courseId))) throw new ArenaError("Fastest Fingers is for trainees enrolled in this course.", 403);
  const sus = await activeSuspension(traineeId, courseId);
  if (sus) throw new ArenaError(suspensionText(sus), 403);
  const sprint = await prisma.arenaSprint.findFirst({ where: { id: sprintId, courseId } });
  if (!sprint) throw new ArenaError("That question could not be found.", 404);
  if (typeof choice !== "string" || !(sprint.options as Opt[]).some((o) => o.key === choice)) throw new ArenaError("Choose one of the answers.");
  if (sprint.status !== "OPEN") return { correct: choice === sprint.correctKey, won: false, late: true };
  const correct = choice === sprint.correctKey;
  try {
    await prisma.arenaSprintAnswer.create({ data: { sprintId, traineeId, choice, correct } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ArenaError("You've already answered this one.", 409);
    throw e;
  }
  let won = false;
  if (correct) {
    // The first correct answer to reach this line wins; everyone after sees the question already closed.
    const r = await prisma.arenaSprint.updateMany({ where: { id: sprintId, status: "OPEN", winnerId: null }, data: { status: "CLOSED", winnerId: traineeId, wonAt: new Date(), closedAt: new Date() } });
    if (r.count === 1) {
      won = true;
      await awardCredits({ traineeId, courseId, points: sprint.points, reason: "FASTEST_FINGERS", refId: sprintId });
      const me = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { name: true } });
      await prisma.arenaChatMessage.create({ data: { courseId, senderId: null, kind: "SYSTEM", body: `🏆 ${me?.name ?? "A trainee"} got it first and wins ${sprint.points} credits.` } });
      void pushToCourse(courseId, traineeId, { title: "⚡ Fastest Fingers is over", body: `${me?.name ?? "A coursemate"} got it first.` });
    }
  }
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
  return { correct, won, late: correct && !won };
}

export async function closeSprint(courseId: string, sprintId: string): Promise<void> {
  const r = await prisma.arenaSprint.updateMany({ where: { id: sprintId, courseId, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date() } });
  if (r.count === 0) throw new ArenaError("That question is not open.", 404);
  await prisma.arenaChatMessage.create({ data: { courseId, senderId: null, kind: "SYSTEM", body: "Fastest Fingers was closed with no winner." } });
  void pokeMany([{ channel: channels.course(courseId), message: { v: 0, k: "chat" } }]);
}

/** For the instructor: recent questions with who won. */
export async function recentSprints(courseId: string) {
  const rows = await prisma.arenaSprint.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, take: 15, include: { winner: { select: { name: true } }, _count: { select: { answers: true } } } });
  return rows.map((r) => ({ id: r.id, question: r.questionText, points: r.points, open: r.status === "OPEN", winner: r.winner?.name ?? null, answers: r._count.answers, at: r.createdAt.getTime() }));
}
