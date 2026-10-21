/**
 * Knowledge Quest — the pure rules (no database, no Prisma), so every number in
 * docs/knowledge-quest-design.md can be tested and tuned in one place.
 *
 * Mastery is calculated from raw answer records every time, never stored, so
 * changing a threshold here updates everyone with no data migration. XP is a
 * separate append-only ledger (see xpForAnswer) and never feeds mastery,
 * levels, ranking or certificates.
 */

export interface QuestConfig {
  mastery: {
    distinctCorrect: number;
    windowSize: number;
    accuracyPercent: number;
    minDays: number;
    refreshAfterDays: number;
    refreshBelowPercent: number;
  };
  xp: {
    correct: number;
    correctWithHint: number;
    correctOnRetry: number;
    missedBeforeBonus: number;
    streakDay: number;
    objectiveMastered: number;
    moduleCompleted: number;
    dailyAnswerCap: number;
  };
  minAnswerSeconds: number;
  wordsPerSecond: number;
  poolMinimum: { practice: number; formal: number };
  problemSolverPercent: number;
  dayOffsetMinutes: number;
}

export const QUEST_DEFAULTS: QuestConfig = {
  mastery: {
    /** Different questions that must have been answered correctly. */
    distinctCorrect: 6,
    /** Accuracy is measured over the last this-many answers. */
    windowSize: 10,
    accuracyPercent: 80,
    /** The correct answers must span at least this many separate days. */
    minDays: 2,
    /** Mastery fades to "needs refresh" after this many days without practice. */
    refreshAfterDays: 30,
    /** …or when accuracy over the window drops below this. */
    refreshBelowPercent: 60,
  },
  xp: {
    correct: 10,
    correctWithHint: 5,
    correctOnRetry: 5,
    missedBeforeBonus: 5,
    streakDay: 10,
    objectiveMastered: 50,
    moduleCompleted: 100,
    /** Daily cap on XP from answers (bonuses for mastery/completion sit outside it). */
    dailyAnswerCap: 100,
  },
  /** Minimum time to read and answer: the larger of this and words / wordsPerSecond. */
  minAnswerSeconds: 3,
  wordsPerSecond: 4,
  /** Approved questions needed per learning objective before a module can go live. */
  poolMinimum: { practice: 10, formal: 6 },
  /** Formal draws this many questions per critical objective (when available). */
  /** Share of a course's objectives that must be mastered to reach Problem Solver. */
  problemSolverPercent: 50,
  /** Day boundaries for streaks and daily caps: Nigeria time (UTC+1, no DST). */
  dayOffsetMinutes: 60,
};

export type RewardKind = "ANSWER" | "MISSED_BONUS" | "STREAK" | "OBJECTIVE_MASTERED" | "MODULE_COMPLETED";
export const ALL_REWARDS: readonly RewardKind[] = ["ANSWER", "MISSED_BONUS", "STREAK", "OBJECTIVE_MASTERED", "MODULE_COMPLETED"];

export const REWARD_LABELS: Record<RewardKind, string> = {
  ANSWER: "XP for correct answers",
  MISSED_BONUS: "Bonus for fixing a question you missed before",
  STREAK: "Practice-day streak bonus",
  OBJECTIVE_MASTERED: "Badge and XP when an objective is mastered",
  MODULE_COMPLETED: "Badge and XP when the module is completed",
};

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" in the quest time zone. */
export function dayKey(date: Date, offsetMinutes: number = QUEST_DEFAULTS.dayOffsetMinutes): string {
  return new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function previousDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Length of the streak that ends on `today`, given the set of day keys with evidence of practice. */
export function streakLength(days: ReadonlySet<string>, today: string): number {
  let n = 0;
  let cursor = today;
  while (days.has(cursor)) {
    n++;
    cursor = previousDayKey(cursor);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Minimum answer time
// ---------------------------------------------------------------------------

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Larger of 3 seconds or question words / 4, in whole seconds. */
export function minAnswerSeconds(questionText: string, cfg: QuestConfig = QUEST_DEFAULTS): number {
  return Math.max(cfg.minAnswerSeconds, Math.ceil(wordCount(questionText) / cfg.wordsPerSecond));
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

export interface AnswerRecord {
  questionId: string;
  correct: boolean;
  answeredAt: Date;
  /** Faster than the minimum answer time: counts against accuracy if wrong, never as evidence. */
  tooFast: boolean;
}

export type MasteryState = "NOT_STARTED" | "LEARNING" | "NEARLY_THERE" | "MASTERED" | "NEEDS_REFRESH";

export interface MasteryResult {
  state: MasteryState;
  /** Different questions answered correctly (evidence only). */
  distinctCorrect: number;
  /** Accuracy over the last window, 0–100, or null with no answers. */
  accuracyPercent: number | null;
  /** Separate days on which evidence answers were given. */
  days: number;
  answered: number;
  lastAnsweredAt: Date | null;
  /** 0–1 progress toward mastery, for progress bars. */
  progress: number;
  /** What is still missing, in plain words (empty when mastered). */
  needs: string[];
}

interface Criteria {
  distinctOk: boolean;
  accuracyOk: boolean;
  daysOk: boolean;
}

function criteriaMet(c: Criteria): boolean {
  return c.distinctOk && c.accuracyOk && c.daysOk;
}

export function masteryFor(
  answers: readonly AnswerRecord[],
  now: Date,
  cfg: QuestConfig = QUEST_DEFAULTS
): MasteryResult {
  const m = cfg.mastery;
  const sorted = [...answers].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
  if (sorted.length === 0) {
    return {
      state: "NOT_STARTED",
      distinctCorrect: 0,
      accuracyPercent: null,
      days: 0,
      answered: 0,
      lastAnsweredAt: null,
      progress: 0,
      needs: [`Answer ${m.distinctCorrect} different questions correctly`],
    };
  }

  const distinct = new Set<string>();
  const evidenceDays = new Set<string>();
  const window: boolean[] = [];
  let everMastered = false;
  let criteria: Criteria = { distinctOk: false, accuracyOk: false, daysOk: false };
  let accuracy = 0;

  for (const a of sorted) {
    if (a.correct && !a.tooFast) {
      distinct.add(a.questionId);
      evidenceDays.add(dayKey(a.answeredAt, cfg.dayOffsetMinutes));
    }
    window.push(a.correct);
    if (window.length > m.windowSize) window.shift();
    accuracy = (window.filter(Boolean).length / window.length) * 100;
    criteria = {
      distinctOk: distinct.size >= m.distinctCorrect,
      accuracyOk: accuracy >= m.accuracyPercent,
      daysOk: evidenceDays.size >= m.minDays,
    };
    if (criteriaMet(criteria)) everMastered = true;
  }

  const last = sorted[sorted.length - 1].answeredAt;
  const idleDays = (now.getTime() - last.getTime()) / 86_400_000;
  const stale = idleDays > m.refreshAfterDays;
  const slipped = accuracy < m.refreshBelowPercent;

  let state: MasteryState;
  if (criteriaMet(criteria) && !stale) {
    state = "MASTERED";
  } else if (everMastered) {
    // Once mastered it stays mastered until a refresh trigger fires.
    state = stale || slipped ? "NEEDS_REFRESH" : "MASTERED";
  } else {
    const met = [criteria.distinctOk, criteria.accuracyOk, criteria.daysOk].filter(Boolean).length;
    state = met >= 2 ? "NEARLY_THERE" : "LEARNING";
  }

  const needs: string[] = [];
  if (state !== "MASTERED") {
    if (!criteria.distinctOk) {
      const left = m.distinctCorrect - distinct.size;
      needs.push(`${left} more different question${left === 1 ? "" : "s"} answered correctly`);
    }
    if (!criteria.accuracyOk) needs.push(`${m.accuracyPercent}% correct over your last ${m.windowSize} answers`);
    if (!criteria.daysOk) needs.push(`practice on ${m.minDays} separate days`);
    if (state === "NEEDS_REFRESH" && needs.length === 0) needs.push("a short refresh to confirm you still remember it");
  }

  const progress =
    state === "MASTERED"
      ? 1
      : (Math.min(distinct.size / m.distinctCorrect, 1) +
          Math.min(accuracy / m.accuracyPercent, 1) +
          Math.min(evidenceDays.size / m.minDays, 1)) /
        3;

  return {
    state,
    distinctCorrect: distinct.size,
    accuracyPercent: Math.round(accuracy),
    days: evidenceDays.size,
    answered: sorted.length,
    lastAnsweredAt: last,
    progress: Math.round(progress * 100) / 100,
    needs,
  };
}

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

export interface XpAnswerContext {
  correct: boolean;
  tooFast: boolean;
  hintUsed: boolean;
  /** This question was already answered wrongly earlier today. */
  wrongEarlierToday: boolean;
  /** This question was answered wrongly on an earlier day. */
  missedOnEarlierDay: boolean;
  /** The missed-before bonus has already been paid for this question. */
  missedBonusPaid: boolean;
  /** This question already earned answer XP today. */
  alreadyEarnedToday: boolean;
  /** Answer XP (incl. missed-before bonus) already earned today. */
  answerXpToday: number;
  enabled: ReadonlySet<RewardKind>;
}

export interface XpAward {
  answerPoints: number;
  missedBonusPoints: number;
  /** True when the daily cap trimmed this answer's XP. */
  cappedByDailyLimit: boolean;
}

export function xpForAnswer(ctx: XpAnswerContext, cfg: QuestConfig = QUEST_DEFAULTS): XpAward {
  const none: XpAward = { answerPoints: 0, missedBonusPoints: 0, cappedByDailyLimit: false };
  if (!ctx.correct || ctx.tooFast) return none;

  let base = 0;
  if (ctx.enabled.has("ANSWER") && !ctx.alreadyEarnedToday) {
    base = ctx.hintUsed ? cfg.xp.correctWithHint : cfg.xp.correct;
    if (ctx.wrongEarlierToday) base = Math.min(base, cfg.xp.correctOnRetry);
  }
  const bonus =
    ctx.enabled.has("MISSED_BONUS") && ctx.missedOnEarlierDay && !ctx.missedBonusPaid ? cfg.xp.missedBeforeBonus : 0;

  const room = Math.max(0, cfg.xp.dailyAnswerCap - ctx.answerXpToday);
  const total = base + bonus;
  if (total <= room) return { answerPoints: base, missedBonusPoints: bonus, cappedByDailyLimit: false };
  // Trim the answer XP first, then the bonus.
  const answerPoints = Math.min(base, room);
  const missedBonusPoints = Math.min(bonus, room - answerPoints);
  return { answerPoints, missedBonusPoints, cappedByDailyLimit: true };
}

/** Streak XP is paid once per day, from the second consecutive day onward. */
export function streakXp(streak: number, enabled: ReadonlySet<RewardKind>, cfg: QuestConfig = QUEST_DEFAULTS): number {
  return enabled.has("STREAK") && streak >= 2 ? cfg.xp.streakDay : 0;
}

// ---------------------------------------------------------------------------
// Levels (from mastery, never from XP)
// ---------------------------------------------------------------------------

export type QuestLevel = "EXPLORER" | "PROBLEM_SOLVER";

export const LEVEL_LABELS: Record<QuestLevel, string> = {
  EXPLORER: "Explorer",
  PROBLEM_SOLVER: "Problem Solver",
};

export function levelFor(
  masteredObjectives: number,
  totalObjectives: number,
  cfg: QuestConfig = QUEST_DEFAULTS
): { level: QuestLevel; nextLevel: QuestLevel | null; masteredPercent: number; neededForNext: number } {
  const masteredPercent = totalObjectives > 0 ? Math.round((masteredObjectives / totalObjectives) * 100) : 0;
  const needed = Math.ceil((totalObjectives * cfg.problemSolverPercent) / 100);
  if (totalObjectives > 0 && masteredObjectives >= needed) {
    return { level: "PROBLEM_SOLVER", nextLevel: null, masteredPercent, neededForNext: 0 };
  }
  return {
    level: "EXPLORER",
    nextLevel: "PROBLEM_SOLVER",
    masteredPercent,
    neededForNext: Math.max(0, needed - masteredObjectives),
  };
}

// ---------------------------------------------------------------------------
// Pool coverage (can this module go live?)
// ---------------------------------------------------------------------------

export interface PoolQuestion {
  objectiveId: string | null;
  pool: "PRACTICE" | "FORMAL" | null;
}

export interface ObjectiveCoverage {
  objectiveId: string;
  practice: number;
  formal: number;
  untagged: number;
  practiceShort: number;
  formalShort: number;
  ok: boolean;
}

/** `questions` must already be filtered to approved questions. */
export function poolCoverage(
  objectiveIds: readonly string[],
  questions: readonly PoolQuestion[],
  cfg: QuestConfig = QUEST_DEFAULTS
): { objectives: ObjectiveCoverage[]; ready: boolean } {
  const objectives = objectiveIds.map((objectiveId) => {
    const mine = questions.filter((q) => q.objectiveId === objectiveId);
    const practice = mine.filter((q) => q.pool === "PRACTICE").length;
    const formal = mine.filter((q) => q.pool === "FORMAL").length;
    const untagged = mine.filter((q) => q.pool === null).length;
    const practiceShort = Math.max(0, cfg.poolMinimum.practice - practice);
    const formalShort = Math.max(0, cfg.poolMinimum.formal - formal);
    return { objectiveId, practice, formal, untagged, practiceShort, formalShort, ok: practiceShort === 0 && formalShort === 0 };
  });
  return { objectives, ready: objectives.length > 0 && objectives.every((o) => o.ok) };
}

/**
 * Splits untagged approved questions between the pools for one objective:
 * about 40% formal (never fewer than needed to reach the formal minimum when
 * possible), the rest practice. Existing tags are respected.
 */
export function suggestSplit(
  untaggedIds: readonly string[],
  existingPractice: number,
  existingFormal: number,
  cfg: QuestConfig = QUEST_DEFAULTS
): { practice: string[]; formal: string[] } {
  const n = untaggedIds.length;
  const total = n + existingPractice + existingFormal;
  const wantFormal = Math.max(Math.round(total * 0.4), Math.min(cfg.poolMinimum.formal, total));
  const formalToAdd = Math.max(0, Math.min(n, wantFormal - existingFormal));
  return {
    formal: untaggedIds.slice(0, formalToAdd),
    practice: untaggedIds.slice(formalToAdd),
  };
}

// ---------------------------------------------------------------------------
// Choosing the next practice question
// ---------------------------------------------------------------------------

export interface PracticeCandidate {
  id: string;
  objectiveId: string;
}

export interface QuestionHistory {
  /** Number of times answered, and whether the latest answer was wrong. */
  answered: number;
  lastWrong: boolean;
  lastAnsweredAt: Date | null;
}

/**
 * Prefers questions never seen, then ones last answered wrongly, then the
 * least recently answered. Never repeats `avoidId` unless it is the only choice.
 * `random` is injectable for tests.
 */
export function pickQuestion(
  candidates: readonly PracticeCandidate[],
  history: ReadonlyMap<string, QuestionHistory>,
  avoidId: string | null,
  random: () => number = Math.random
): PracticeCandidate | null {
  if (candidates.length === 0) return null;
  const pool = candidates.length > 1 && avoidId ? candidates.filter((c) => c.id !== avoidId) : [...candidates];
  const rank = (c: PracticeCandidate): number => {
    const h = history.get(c.id);
    if (!h || h.answered === 0) return 0;
    if (h.lastWrong) return 1;
    return 2;
  };
  const best = Math.min(...pool.map(rank));
  let tier = pool.filter((c) => rank(c) === best);
  if (best === 2) {
    const oldest = Math.min(...tier.map((c) => history.get(c.id)?.lastAnsweredAt?.getTime() ?? 0));
    tier = tier.filter((c) => (history.get(c.id)?.lastAnsweredAt?.getTime() ?? 0) === oldest);
  }
  return tier[Math.floor(random() * tier.length)] ?? tier[0];
}

/** For "practise everything": the objective with the least progress that still has questions. */
export function pickObjective(
  objectives: readonly { objectiveId: string; progress: number; hasQuestions: boolean }[]
): string | null {
  const open = objectives.filter((o) => o.hasQuestions);
  if (open.length === 0) return null;
  const needing = open.filter((o) => o.progress < 1);
  const from = needing.length > 0 ? needing : open;
  return from.reduce((a, b) => (b.progress < a.progress ? b : a)).objectiveId;
}

// ---------------------------------------------------------------------------
// Formal assessment: pool split, draw, and mastery gates
// ---------------------------------------------------------------------------

/** The formal assessment never uses practice-pool questions. Untagged legacy questions stay formal. */
export function isFormalEligible(pool: "PRACTICE" | "FORMAL" | null): boolean {
  return pool !== "PRACTICE";
}

/**
 * Draws a formal attempt so that it tests every learning objective of the module. Questions are taken one objective at a time in turn, so each
 * objective gets a question before any objective gets a second, until the attempt is full; any questions not tied to an objective fill what is left.
 * With no numQuestions the whole pool is used. This only chooses what is asked: whether the trainee passes depends on the overall score alone.
 */
export function drawFormal<T extends { id: string }>(
  pool: readonly T[],
  opts: {
    numQuestions: number | null;
    objectiveIds: readonly string[];
    shuffle: <U>(items: U[]) => U[];
    randomize: boolean;
    objectiveOf: (question: T) => string | null;
  }
): T[] {
  const ordered = opts.randomize ? opts.shuffle([...pool]) : [...pool];
  const limit = opts.numQuestions && opts.numQuestions < ordered.length ? opts.numQuestions : ordered.length;
  if (limit >= ordered.length || opts.objectiveIds.length === 0) return ordered.slice(0, limit);

  const byObjective = new Map<string, T[]>(opts.objectiveIds.map((id) => [id, []]));
  const rest: T[] = [];
  for (const q of ordered) {
    const id = opts.objectiveOf(q);
    const list = id ? byObjective.get(id) : undefined;
    if (list) list.push(q); else rest.push(q);
  }
  const chosen: T[] = [];
  const queues = opts.objectiveIds.map((id) => byObjective.get(id) ?? []);
  for (let round = 0; chosen.length < limit; round++) {
    let tookAny = false;
    for (const q of queues) {
      if (chosen.length >= limit) break;
      if (round < q.length) { chosen.push(q[round]); tookAny = true; }
    }
    if (!tookAny) break;
  }
  for (const q of rest) {
    if (chosen.length >= limit) break;
    chosen.push(q);
  }
  return opts.randomize ? opts.shuffle(chosen) : chosen;
}

