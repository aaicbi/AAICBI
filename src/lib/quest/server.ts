/**
 * Knowledge Quest — the database half. Everything a trainee sees or earns in
 * practice mode goes through here so the rules stay in src/lib/quest/core.ts:
 *  - the server serves the question and starts the clock; answer keys never
 *    leave the server before the answer is submitted;
 *  - mastery is calculated from raw PracticeAnswer rows, never stored;
 *  - XP is an append-only ledger with an idempotency key per payment;
 *  - nothing here touches certificates or the formal assessment's result.
 */
import { prisma } from "@/lib/prisma";
import {
  ALL_REWARDS,
  QUEST_DEFAULTS,
  dayKey,
  evaluateGates,
  levelFor,
  masteryFor,
  minAnswerSeconds,
  pickObjective,
  pickQuestion,
  practiceRequirementMet,
  streakLength,
  streakXp,
  xpForAnswer,
  type AnswerRecord,
  type MasteryResult,
  type QuestionHistory,
  type RewardKind,
} from "@/lib/quest/core";
import { shuffle } from "@/lib/shuffle";
import { canTraineeAccessCourse, getModuleAccessLevel } from "@/lib/courseAccess";
import { getModuleLockStatus } from "@/lib/progress";

function httpError(status: number, message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

/** Recently answered questions are not re-served for this long (no instant retry with the answer fresh in mind). */
const RECENT_MINUTES = 10;
/** A question served but not answered is resumed (not re-rolled) for this long. */
const RESUME_MINUTES = 10;

export interface QuestSettings {
  practiceEnabled: boolean;
  practiceBeforeFormal: boolean;
  practiceRequiredPercent: number;
  enabledRewards: RewardKind[];
}

export const DEFAULT_QUEST_SETTINGS: QuestSettings = {
  practiceEnabled: false,
  practiceBeforeFormal: false,
  practiceRequiredPercent: 70,
  enabledRewards: [...ALL_REWARDS],
};

export function cleanRewards(input: unknown): RewardKind[] {
  const list = Array.isArray(input) ? input : [];
  return ALL_REWARDS.filter((k) => list.includes(k));
}

export async function loadQuestSettings(moduleId: string): Promise<QuestSettings> {
  const row = await prisma.moduleQuestSettings.findUnique({ where: { moduleId } });
  if (!row) return { ...DEFAULT_QUEST_SETTINGS, enabledRewards: [...ALL_REWARDS] };
  return {
    practiceEnabled: row.practiceEnabled,
    practiceBeforeFormal: row.practiceBeforeFormal,
    practiceRequiredPercent: row.practiceRequiredPercent,
    enabledRewards: cleanRewards(row.enabledRewards),
  };
}

/** The approved practice-pool questions of a module that a trainee can actually be served. */
const practicePoolWhere = (moduleId: string) => ({
  exam: { moduleId },
  bankStatus: "APPROVED" as const,
  bankPool: "PRACTICE" as const,
  bankObjectiveId: { not: null },
  needsReview: false,
});

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/** The trainee may reach this module at all: enrolled, course reachable, module unlocked. */
export async function assertModuleReachable(traineeId: string, moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, title: true, courseId: true, course: { select: { id: true, title: true, status: true } } },
  });
  const notAvailable = httpError(404, "This isn't available for this module.");
  if (!mod) throw notAvailable;
  if (!(await canTraineeAccessCourse(mod.course.status, traineeId, mod.courseId))) throw notAvailable;
  if ((await getModuleAccessLevel(traineeId, mod.courseId, moduleId)) === "NONE") throw notAvailable;
  const lock = await getModuleLockStatus(mod.courseId, moduleId, traineeId);
  if (!lock?.unlocked) throw httpError(403, "This module isn't unlocked yet — complete the previous module first.");
  return mod;
}

export async function assertPracticeAccess(traineeId: string, moduleId: string) {
  const mod = await assertModuleReachable(traineeId, moduleId).catch((e: Error & { status?: number }) => {
    if (e.status === 404) throw httpError(404, "Practice isn't available for this module.");
    throw e;
  });
  const settings = await loadQuestSettings(moduleId);
  if (!settings.practiceEnabled) throw httpError(404, "Practice isn't available for this module.");
  return { module: mod, settings };
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

type AnsweredRow = { objectiveId: string; questionId: string; correct: boolean | null; answeredAt: Date | null; tooFast: boolean };

function toRecord(r: AnsweredRow): AnswerRecord {
  return { questionId: r.questionId, correct: r.correct === true, answeredAt: r.answeredAt as Date, tooFast: r.tooFast };
}

function groupByObjective(rows: readonly AnsweredRow[]): Map<string, AnswerRecord[]> {
  const map = new Map<string, AnswerRecord[]>();
  for (const r of rows) {
    if (!r.answeredAt) continue;
    const list = map.get(r.objectiveId) ?? [];
    list.push(toRecord(r));
    map.set(r.objectiveId, list);
  }
  return map;
}

async function answeredRows(traineeId: string, where: { moduleId?: string; objectiveId?: { in: string[] } }): Promise<AnsweredRow[]> {
  return prisma.practiceAnswer.findMany({
    where: { traineeId, answeredAt: { not: null }, ...where },
    select: { objectiveId: true, questionId: true, correct: true, answeredAt: true, tooFast: true },
  });
}

/** Mastery for every objective of a module, for one trainee. */
export async function moduleMasteries(traineeId: string, moduleId: string, now = new Date()) {
  const objectives = await prisma.moduleLearningObjective.findMany({
    where: { moduleId },
    orderBy: { order: "asc" },
    select: { id: true, text: true, isCritical: true },
  });
  const grouped = groupByObjective(await answeredRows(traineeId, { moduleId }));
  return objectives.map((o) => ({ ...o, mastery: masteryFor(grouped.get(o.id) ?? [], now) }));
}

// ---------------------------------------------------------------------------
// XP and overview
// ---------------------------------------------------------------------------

async function evidenceDays(traineeId: string, now: Date): Promise<Set<string>> {
  const since = new Date(now.getTime() - 40 * 86_400_000);
  const rows = await prisma.practiceAnswer.findMany({
    where: { traineeId, answeredAt: { gte: since }, correct: true, tooFast: false },
    select: { answeredAt: true },
  });
  return new Set(rows.map((r) => dayKey(r.answeredAt as Date)));
}

async function xpTotals(traineeId: string, moduleId: string, today: string) {
  const [moduleTotal, allTotal, todayAnswers] = await Promise.all([
    prisma.xpEntry.aggregate({ where: { traineeId, moduleId }, _sum: { points: true } }),
    prisma.xpEntry.aggregate({ where: { traineeId }, _sum: { points: true } }),
    prisma.xpEntry.aggregate({
      where: { traineeId, dayKey: today, kind: { in: ["ANSWER", "MISSED_BONUS"] } },
      _sum: { points: true },
    }),
  ]);
  return {
    moduleXp: moduleTotal._sum.points ?? 0,
    totalXp: allTotal._sum.points ?? 0,
    answerXpToday: todayAnswers._sum.points ?? 0,
  };
}

export interface ObjectiveOverview {
  id: string;
  text: string;
  isCritical: boolean;
  questions: number;
  mastery: MasteryOverview;
}

export interface MasteryOverview {
  state: MasteryResult["state"];
  distinctCorrect: number;
  accuracyPercent: number | null;
  days: number;
  answered: number;
  progress: number;
  needs: string[];
}

function overviewOf(m: MasteryResult): MasteryOverview {
  return {
    state: m.state,
    distinctCorrect: m.distinctCorrect,
    accuracyPercent: m.accuracyPercent,
    days: m.days,
    answered: m.answered,
    progress: m.progress,
    needs: m.needs,
  };
}

async function courseLevel(traineeId: string, courseId: string, now: Date) {
  const objectives = await prisma.moduleLearningObjective.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const ids = objectives.map((o) => o.id);
  const grouped = groupByObjective(await answeredRows(traineeId, { objectiveId: { in: ids } }));
  const mastered = ids.filter((id) => masteryFor(grouped.get(id) ?? [], now).state === "MASTERED").length;
  return { ...levelFor(mastered, ids.length), masteredObjectives: mastered, totalObjectives: ids.length };
}

export async function practiceOverview(traineeId: string, moduleId: string, now = new Date()) {
  const { module: mod, settings } = await assertPracticeAccess(traineeId, moduleId);
  const today = dayKey(now);
  const [masteries, pool, totals, days, level] = await Promise.all([
    moduleMasteries(traineeId, moduleId, now),
    prisma.question.groupBy({ by: ["bankObjectiveId"], where: practicePoolWhere(moduleId), _count: { _all: true } }),
    xpTotals(traineeId, moduleId, today),
    evidenceDays(traineeId, now),
    courseLevel(traineeId, mod.courseId, now),
  ]);
  const counts = new Map(pool.map((g) => [g.bankObjectiveId, g._count._all]));
  const objectives: ObjectiveOverview[] = masteries.map((o) => ({
    id: o.id,
    text: o.text,
    isCritical: o.isCritical,
    questions: counts.get(o.id) ?? 0,
    mastery: overviewOf(o.mastery),
  }));
  const eligibility = await formalEligibility(traineeId, moduleId, settings, now);
  return {
    module: { id: mod.id, title: mod.title, courseId: mod.courseId, courseTitle: mod.course.title },
    objectives,
    masteredCount: objectives.filter((o) => o.mastery.state === "MASTERED").length,
    xp: {
      module: totals.moduleXp,
      total: totals.totalXp,
      today: totals.answerXpToday,
      dailyCap: QUEST_DEFAULTS.xp.dailyAnswerCap,
    },
    streak: streakLength(days, today),
    level: {
      level: level.level,
      nextLevel: level.nextLevel,
      masteredPercent: level.masteredPercent,
      neededForNext: level.neededForNext,
      masteredObjectives: level.masteredObjectives,
      totalObjectives: level.totalObjectives,
    },
    rewards: settings.enabledRewards,
    formal: eligibility,
  };
}

// ---------------------------------------------------------------------------
// Serving a question
// ---------------------------------------------------------------------------

export interface ServedPracticeQuestion {
  practiceAnswerId: string;
  objective: { id: string; text: string };
  question: { text: string; options: { key: string; text: string }[] };
  minSeconds: number;
  hintUsed: boolean;
}

type PoolQuestion = {
  id: string;
  text: string;
  bankObjectiveId: string | null;
  options: { key: string; text: string; isCorrect: boolean }[];
};

const servable = (q: PoolQuestion) => q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length === 1;

async function loadServed(row: { id: string; objectiveId: string; questionId: string; hintUsed: boolean }, moduleId: string) {
  const question = await prisma.question.findFirst({
    where: { id: row.questionId, ...practicePoolWhere(moduleId) },
    select: { id: true, text: true, options: { select: { key: true, text: true }, orderBy: { order: "asc" } } },
  });
  const objective = await prisma.moduleLearningObjective.findUnique({
    where: { id: row.objectiveId },
    select: { id: true, text: true },
  });
  if (!question || !objective) return null;
  const served: ServedPracticeQuestion = {
    practiceAnswerId: row.id,
    objective,
    question: { text: question.text, options: shuffle(question.options) },
    minSeconds: minAnswerSeconds(question.text),
    hintUsed: row.hintUsed,
  };
  return served;
}

export async function serveQuestion(
  traineeId: string,
  moduleId: string,
  objectiveId: string | null,
  now = new Date()
): Promise<ServedPracticeQuestion | null> {
  await assertPracticeAccess(traineeId, moduleId);

  // Resume a question that was served and not answered yet (reload, double tap).
  const pending = await prisma.practiceAnswer.findFirst({
    where: {
      traineeId,
      moduleId,
      answeredAt: null,
      servedAt: { gte: new Date(now.getTime() - RESUME_MINUTES * 60_000) },
      ...(objectiveId ? { objectiveId } : {}),
    },
    orderBy: { servedAt: "desc" },
    select: { id: true, objectiveId: true, questionId: true, hintUsed: true },
  });
  if (pending) {
    const served = await loadServed(pending, moduleId);
    if (served) return served;
  }

  const questions = (await prisma.question.findMany({
    where: { ...practicePoolWhere(moduleId), ...(objectiveId ? { bankObjectiveId: objectiveId } : {}) },
    select: {
      id: true,
      text: true,
      bankObjectiveId: true,
      options: { select: { key: true, text: true, isCorrect: true }, orderBy: { order: "asc" } },
    },
  })) as PoolQuestion[];
  const usable = questions.filter(servable);
  if (usable.length === 0) return null;

  const history = await prisma.practiceAnswer.findMany({
    where: { traineeId, moduleId, answeredAt: { not: null }, questionId: { in: usable.map((q) => q.id) } },
    orderBy: { answeredAt: "asc" },
    select: { questionId: true, correct: true, answeredAt: true },
  });
  const byQuestion = new Map<string, QuestionHistory>();
  for (const h of history) {
    const cur = byQuestion.get(h.questionId);
    byQuestion.set(h.questionId, {
      answered: (cur?.answered ?? 0) + 1,
      lastWrong: h.correct === false,
      lastAnsweredAt: h.answeredAt,
    });
  }
  const recentCutoff = now.getTime() - RECENT_MINUTES * 60_000;
  const notRecent = usable.filter((q) => (byQuestion.get(q.id)?.lastAnsweredAt?.getTime() ?? 0) < recentCutoff);
  const candidates = notRecent.length > 0 ? notRecent : usable;

  // Which objective: the one asked for, or the weakest that has questions.
  let chosenObjective = objectiveId;
  if (!chosenObjective) {
    const masteries = await moduleMasteries(traineeId, moduleId, now);
    const have = new Set(candidates.map((q) => q.bankObjectiveId));
    chosenObjective = pickObjective(
      masteries.map((o) => ({ objectiveId: o.id, progress: o.mastery.progress, hasQuestions: have.has(o.id) }))
    );
  }
  if (!chosenObjective) return null;

  const lastAnswered = await prisma.practiceAnswer.findFirst({
    where: { traineeId, moduleId, answeredAt: { not: null } },
    orderBy: { answeredAt: "desc" },
    select: { questionId: true },
  });
  const picked = pickQuestion(
    candidates.filter((q) => q.bankObjectiveId === chosenObjective).map((q) => ({ id: q.id, objectiveId: chosenObjective as string })),
    byQuestion,
    lastAnswered?.questionId ?? null
  );
  if (!picked) return null;

  const row = await prisma.practiceAnswer.create({
    data: { traineeId, moduleId, objectiveId: picked.objectiveId, questionId: picked.id, servedAt: now },
    select: { id: true, objectiveId: true, questionId: true, hintUsed: true },
  });
  return loadServed(row, moduleId);
}

// ---------------------------------------------------------------------------
// Hint
// ---------------------------------------------------------------------------

export async function useHint(traineeId: string, moduleId: string, practiceAnswerId: string) {
  const { module: mod } = await assertPracticeAccess(traineeId, moduleId);
  const row = await prisma.practiceAnswer.findFirst({
    where: { id: practiceAnswerId, traineeId, moduleId, answeredAt: null },
    select: { id: true, questionId: true, objective: { select: { text: true } } },
  });
  if (!row) throw httpError(404, "That question isn't open any more.");
  await prisma.practiceAnswer.update({ where: { id: row.id }, data: { hintUsed: true } });
  return { hint: await hintFor(row.questionId, row.objective.text, mod.courseId) };
}

async function hintFor(questionId: string, objectiveText: string, courseId: string) {
  const sources = await prisma.questionSourceMaterial.findMany({
    where: { questionId },
    select: { material: { select: { title: true, lesson: { select: { title: true } } } } },
  });
  return {
    objective: objectiveText,
    sources: sources.map((s) => ({ material: s.material.title, lesson: s.material.lesson.title })),
    courseUrl: `/trainee/courses/${courseId}`,
  };
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

export async function addXp(entry: {
  traineeId: string;
  moduleId: string;
  kind: "ANSWER" | "MISSED_BONUS" | "STREAK" | "OBJECTIVE_MASTERED" | "MODULE_COMPLETED";
  points: number;
  dayKey: string;
  dedupeKey: string;
  objectiveId?: string;
  questionId?: string;
}): Promise<number> {
  if (entry.points <= 0) return 0;
  try {
    await prisma.xpEntry.create({ data: entry });
    return entry.points;
  } catch (e) {
    // Already paid (a duplicate request, or two requests racing): the ledger key says so.
    if ((e as { code?: string }).code === "P2002") return 0;
    throw e;
  }
}

export async function submitAnswer(
  traineeId: string,
  moduleId: string,
  practiceAnswerId: string,
  selectedKey: string,
  now = new Date()
) {
  const { module: mod, settings } = await assertPracticeAccess(traineeId, moduleId);
  const enabled = new Set<RewardKind>(settings.enabledRewards);

  const row = await prisma.practiceAnswer.findFirst({
    where: { id: practiceAnswerId, traineeId, moduleId },
    select: { id: true, objectiveId: true, questionId: true, servedAt: true, answeredAt: true, hintUsed: true },
  });
  if (!row) throw httpError(404, "That question isn't open any more.");

  const question = await prisma.question.findUnique({
    where: { id: row.questionId },
    select: { text: true, explanation: true, options: { select: { key: true, isCorrect: true } } },
  });
  if (!question) throw httpError(404, "That question isn't available any more.");
  const correctKey = question.options.find((o) => o.isCorrect)?.key ?? null;
  if (!question.options.some((o) => o.key === selectedKey)) throw httpError(400, "Choose one of the options.");

  const sources = await hintFor(row.questionId, "", mod.courseId);

  if (row.answeredAt) {
    // Already answered (a double tap): answer with what was recorded, award nothing twice.
    const stored = await prisma.practiceAnswer.findUniqueOrThrow({
      where: { id: row.id },
      select: { correct: true, tooFast: true, secondsTaken: true },
    });
    return {
      repeated: true as const,
      correct: stored.correct === true,
      correctOptionKey: correctKey,
      explanation: question.explanation,
      tooFast: stored.tooFast,
      minSeconds: minAnswerSeconds(question.text),
      sources: sources.sources,
      courseUrl: sources.courseUrl,
    };
  }

  const correct = correctKey !== null && selectedKey === correctKey;
  const secondsTaken = Math.max(0, Math.round((now.getTime() - row.servedAt.getTime()) / 1000));
  const minSeconds = minAnswerSeconds(question.text);
  const tooFast = secondsTaken < minSeconds;

  // Claim the answer exactly once (guards against two requests racing).
  const claimed = await prisma.practiceAnswer.updateMany({
    where: { id: row.id, answeredAt: null },
    data: { answeredAt: now, selectedOptionKey: selectedKey, correct, secondsTaken, tooFast },
  });
  if (claimed.count === 0) {
    return {
      repeated: true as const,
      correct,
      correctOptionKey: correctKey,
      explanation: question.explanation,
      tooFast,
      minSeconds,
      sources: sources.sources,
      courseUrl: sources.courseUrl,
    };
  }

  const today = dayKey(now);

  // --- answer XP ---
  const priorOfQuestion = await prisma.practiceAnswer.findMany({
    where: { traineeId, questionId: row.questionId, answeredAt: { not: null }, id: { not: row.id } },
    select: { correct: true, answeredAt: true },
  });
  const wrongs = priorOfQuestion.filter((p) => p.correct === false);
  const earnedToday = await prisma.xpEntry.findUnique({
    where: { dedupeKey: `ANSWER:${traineeId}:${row.questionId}:${today}` },
    select: { id: true },
  });
  const bonusPaid = await prisma.xpEntry.findUnique({
    where: { dedupeKey: `MISSED:${traineeId}:${row.questionId}` },
    select: { id: true },
  });
  const todaySum = await prisma.xpEntry.aggregate({
    where: { traineeId, dayKey: today, kind: { in: ["ANSWER", "MISSED_BONUS"] } },
    _sum: { points: true },
  });
  const award = xpForAnswer({
    correct,
    tooFast,
    hintUsed: row.hintUsed,
    wrongEarlierToday: wrongs.some((w) => dayKey(w.answeredAt as Date) === today),
    missedOnEarlierDay: wrongs.some((w) => dayKey(w.answeredAt as Date) < today),
    missedBonusPaid: !!bonusPaid,
    alreadyEarnedToday: !!earnedToday,
    answerXpToday: todaySum._sum.points ?? 0,
    enabled,
  });
  const base = { traineeId, moduleId, dayKey: today, objectiveId: row.objectiveId, questionId: row.questionId };
  const answerXp = await addXp({ ...base, kind: "ANSWER", points: award.answerPoints, dedupeKey: `ANSWER:${traineeId}:${row.questionId}:${today}` });
  const bonusXp = await addXp({ ...base, kind: "MISSED_BONUS", points: award.missedBonusPoints, dedupeKey: `MISSED:${traineeId}:${row.questionId}` });

  // --- streak XP (a correct, not-too-fast answer is evidence of practice today) ---
  let streakPaid = 0;
  const days = await evidenceDays(traineeId, now);
  const streak = streakLength(days, today);
  if (correct && !tooFast) {
    streakPaid = await addXp({
      traineeId,
      moduleId,
      kind: "STREAK",
      points: streakXp(streak, enabled),
      dayKey: today,
      dedupeKey: `STREAK:${traineeId}:${today}`,
    });
  }

  // --- mastery now and a moment ago ---
  const rows = await answeredRows(traineeId, { moduleId });
  const grouped = groupByObjective(rows);
  const after = masteryFor(grouped.get(row.objectiveId) ?? [], now);
  const beforeRecords = (grouped.get(row.objectiveId) ?? []).filter((r) => r.answeredAt.getTime() !== now.getTime());
  const before = masteryFor(beforeRecords, new Date(now.getTime() - 1));
  const objectiveJustMastered = after.state === "MASTERED" && before.state !== "MASTERED";

  let objectiveXp = 0;
  let moduleXp = 0;
  let moduleCompleted = false;
  if (objectiveJustMastered && enabled.has("OBJECTIVE_MASTERED")) {
    objectiveXp = await addXp({
      traineeId,
      moduleId,
      kind: "OBJECTIVE_MASTERED",
      points: QUEST_DEFAULTS.xp.objectiveMastered,
      dayKey: today,
      objectiveId: row.objectiveId,
      dedupeKey: `OBJ:${traineeId}:${row.objectiveId}`,
    });
  }
  if (objectiveJustMastered) {
    const all = await prisma.moduleLearningObjective.findMany({ where: { moduleId }, select: { id: true } });
    moduleCompleted = all.every((o) => masteryFor(grouped.get(o.id) ?? [], now).state === "MASTERED");
    if (moduleCompleted && enabled.has("MODULE_COMPLETED")) {
      moduleXp = await addXp({
        traineeId,
        moduleId,
        kind: "MODULE_COMPLETED",
        points: QUEST_DEFAULTS.xp.moduleCompleted,
        dayKey: today,
        dedupeKey: `MOD:${traineeId}:${moduleId}`,
      });
    }
  }

  const totals = await xpTotals(traineeId, moduleId, today);
  const earned = answerXp + bonusXp + streakPaid + objectiveXp + moduleXp;

  return {
    repeated: false as const,
    correct,
    correctOptionKey: correctKey,
    explanation: question.explanation,
    tooFast,
    minSeconds,
    secondsTaken,
    sources: sources.sources,
    courseUrl: sources.courseUrl,
    xp: {
      earned,
      answer: answerXp,
      missedBonus: bonusXp,
      streak: streakPaid,
      objective: objectiveXp,
      module: moduleXp,
      cappedByDailyLimit: award.cappedByDailyLimit,
      today: totals.answerXpToday,
      dailyCap: QUEST_DEFAULTS.xp.dailyAnswerCap,
      total: totals.totalXp,
    },
    streakDays: streak,
    mastery: overviewOf(after),
    objectiveJustMastered,
    moduleCompleted,
  };
}

// ---------------------------------------------------------------------------
// Formal assessment hooks
// ---------------------------------------------------------------------------

export interface FormalEligibility {
  required: boolean;
  met: boolean;
  requiredPercent: number;
  masteredObjectives: number;
  totalObjectives: number;
}

/** Whether the practice requirement (if the instructor set one) is met for this module's formal assessment. */
export async function formalEligibility(
  traineeId: string,
  moduleId: string,
  settings?: QuestSettings,
  now = new Date()
): Promise<FormalEligibility> {
  const s = settings ?? (await loadQuestSettings(moduleId));
  const none = { required: false, met: true, requiredPercent: s.practiceRequiredPercent, masteredObjectives: 0, totalObjectives: 0 };
  if (!s.practiceEnabled || !s.practiceBeforeFormal) return none;

  const unlocked = await prisma.formalUnlock.findUnique({ where: { traineeId_moduleId: { traineeId, moduleId } } });
  const masteries = await moduleMasteries(traineeId, moduleId, now);
  // Only objectives that have practice questions can be mastered, so only those count.
  const pool = await prisma.question.groupBy({ by: ["bankObjectiveId"], where: practicePoolWhere(moduleId), _count: { _all: true } });
  const withQuestions = new Set(pool.map((g) => g.bankObjectiveId));
  const counted = masteries.filter((o) => withQuestions.has(o.id));
  const mastered = counted.filter((o) => o.mastery.state === "MASTERED").length;
  const met = !!unlocked || practiceRequirementMet(mastered, counted.length, s.practiceRequiredPercent);
  return { required: true, met, requiredPercent: s.practiceRequiredPercent, masteredObjectives: mastered, totalObjectives: counted.length };
}

/** Called when a trainee starts the formal assessment. Throws 403 when the practice requirement isn't met. */
export async function requireFormalUnlocked(traineeId: string, moduleId: string): Promise<void> {
  const e = await formalEligibility(traineeId, moduleId);
  if (!e.required) return;
  if (!e.met) {
    throw httpError(
      403,
      `Practise first: master at least ${e.requiredPercent}% of this module's objectives (${e.masteredObjectives} of ${e.totalObjectives} so far) to unlock the assessment.`
    );
  }
  // Remember it: a later lapse in practice mastery must never lock them out again.
  await prisma.formalUnlock.upsert({
    where: { traineeId_moduleId: { traineeId, moduleId } },
    create: { traineeId, moduleId },
    update: {},
  });
}

export async function criticalObjectiveIds(moduleId: string): Promise<string[]> {
  const rows = await prisma.moduleLearningObjective.findMany({
    where: { moduleId, isCritical: true },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Critical objectives a submitted attempt fell short on (empty when there are none or it has no gates). */
export async function failedGateObjectives(attemptId: string, passMarkPercent: number): Promise<string[]> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { exam: { select: { moduleId: true } }, answers: { select: { questionId: true, isCorrect: true } } },
  });
  const moduleId = attempt?.exam.moduleId;
  if (!attempt || !moduleId) return [];
  const critical = await prisma.moduleLearningObjective.findMany({
    where: { moduleId, isCritical: true },
    select: { id: true, text: true },
  });
  if (critical.length === 0) return [];
  const questions = await prisma.question.findMany({
    where: { id: { in: attempt.answers.map((a) => a.questionId) } },
    select: { id: true, bankObjectiveId: true },
  });
  const objectiveOf = new Map(questions.map((q) => [q.id, q.bankObjectiveId]));
  const gate = evaluateGates(
    passMarkPercent,
    critical.map((c) => c.id),
    attempt.answers.map((a) => ({ objectiveId: objectiveOf.get(a.questionId) ?? null, correct: a.isCorrect === true }))
  );
  return critical.filter((c) => gate.failedObjectiveIds.includes(c.id)).map((c) => c.text);
}
