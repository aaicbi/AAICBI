/**
 * Game Studio, the database half: the game library, assigning games to
 * modules, the items the non-quiz formats play from, the preview, and what a
 * trainee sees and earns when they play.
 *
 * Rules that hold throughout:
 *  - trainees only ever get APPROVED items and LIVE assignments;
 *  - an item written by Loop starts as a DRAFT and only a person approves it;
 *  - the answer key never leaves the server until the answer is submitted;
 *  - a QUIZ game plays from the module's approved question bank (see
 *    quest/server.ts), and its assignment switches that module's practice on;
 *  - XP goes through the same ledger and rules as practice mode.
 */
import { prisma } from "@/lib/prisma";
import {
  ALL_REWARDS,
  QUEST_DEFAULTS,
  dayKey,
  minAnswerSeconds,
  xpForAnswer,
  type RewardKind,
} from "@/lib/quest/core";
import {
  FORMAT_INFO,
  gradeItem,
  isItemFormat,
  itemText,
  itemTitle,
  serveItem,
  validateItemContent,
  type GameFormat,
  type ItemContent,
  type ItemFormat,
  type Served,
} from "@/lib/quest/games";
import { QuestAdminError, applyQuestSettings, questSnapshot } from "@/lib/quest/admin";
import { addXp, assertModuleReachable, awardStreak, cleanRewards, settleMastery } from "@/lib/quest/server";
import { shuffle } from "@/lib/shuffle";
import { coursesWhere, gamesWhere, type StudioSession } from "@/lib/quest/studioAccess";

export class StudioError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const GAME_FORMATS = Object.keys(FORMAT_INFO) as GameFormat[];
export const isGameFormat = (f: unknown): f is GameFormat => typeof f === "string" && (GAME_FORMATS as string[]).includes(f);

// ---------------------------------------------------------------------------
// Library and overview
// ---------------------------------------------------------------------------

export async function studioOverview(session: StudioSession) {
  const courseFilter = await coursesWhere(session);
  const [games, courses] = await Promise.all([
    prisma.game.findMany({
      where: gamesWhere(session),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        format: true,
        description: true,
        enabledRewards: true,
        assignments: { select: { moduleId: true, live: true } },
      },
    }),
    prisma.course.findMany({
      where: courseFilter,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            _count: { select: { learningObjectives: true } },
            gameAssignments: { select: { gameId: true, live: true } },
          },
        },
      },
    }),
  ]);
  return {
    permissions: session.permissions,
    games: games.map((g) => ({
      id: g.id,
      title: g.title,
      format: g.format,
      description: g.description,
      enabledRewards: cleanRewards(g.enabledRewards),
      assignedModules: g.assignments.length,
      liveModules: g.assignments.filter((a) => a.live).length,
    })),
    courses: courses
      .filter((c) => c.modules.length > 0)
      .map((c) => ({
        id: c.id,
        title: c.title,
        modules: c.modules.map((m) => ({
          id: m.id,
          title: m.title,
          objectives: m._count.learningObjectives,
          assigned: m.gameAssignments.map((a) => ({ gameId: a.gameId, live: a.live })),
        })),
      })),
    formats: GAME_FORMATS.map((f) => ({ format: f, ...FORMAT_INFO[f] })),
  };
}

export async function createGame(userId: string, input: { title: string; format: GameFormat; description?: string | null }) {
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new StudioError("Give the game a name.", 400);
  if (!isGameFormat(input.format)) throw new StudioError("Choose a game format.", 400);
  return prisma.game.create({
    data: { title, format: input.format, description: input.description?.trim().slice(0, 500) || null, createdById: userId },
    select: { id: true, title: true, format: true },
  });
}

export async function updateGame(id: string, input: { title?: string; description?: string | null; enabledRewards?: string[] }) {
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, format: true } });
  if (!game) throw new StudioError("That game could not be found.", 404);
  const data: { title?: string; description?: string | null; enabledRewards?: string[] } = {};
  if (input.title !== undefined) {
    const t = input.title.trim().slice(0, 120);
    if (!t) throw new StudioError("Give the game a name.", 400);
    data.title = t;
  }
  if (input.description !== undefined) data.description = input.description?.trim().slice(0, 500) || null;
  if (input.enabledRewards !== undefined) data.enabledRewards = cleanRewards(input.enabledRewards);
  await prisma.game.update({ where: { id }, data });
  // A quiz game's rewards are the rewards its modules pay.
  if (game.format === "QUIZ" && data.enabledRewards) {
    const live = await prisma.gameAssignment.findMany({ where: { gameId: id, live: true }, select: { moduleId: true } });
    for (const a of live) await applyQuestSettings(a.moduleId, { enabledRewards: data.enabledRewards });
  }
}

export async function deleteGame(id: string) {
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, format: true } });
  if (!game) throw new StudioError("That game could not be found.", 404);
  if (game.format === "QUIZ") {
    const live = await prisma.gameAssignment.findMany({ where: { gameId: id, live: true }, select: { moduleId: true } });
    for (const a of live) await applyQuestSettings(a.moduleId, { practiceEnabled: false });
  }
  await prisma.game.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Assigning a game to a module
// ---------------------------------------------------------------------------

export async function assignGame(gameId: string, moduleId: string, opts: { assigned: boolean; live?: boolean; openToVisitors?: boolean }) {
  const [game, mod] = await Promise.all([
    prisma.game.findUnique({ where: { id: gameId }, select: { id: true, format: true, enabledRewards: true } }),
    prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } }),
  ]);
  if (!game) throw new StudioError("That game could not be found.", 404);
  if (!mod) throw new StudioError("That module could not be found.", 404);

  const existing = await prisma.gameAssignment.findUnique({ where: { gameId_moduleId: { gameId, moduleId } } });

  if (!opts.assigned) {
    if (existing?.live && game.format === "QUIZ") await applyQuestSettings(moduleId, { practiceEnabled: false });
    if (existing) await prisma.gameAssignment.delete({ where: { id: existing.id } });
    return;
  }

  const wantLive = opts.live ?? existing?.live ?? false;
  if (wantLive) {
    if (game.format === "QUIZ") {
      const other = await prisma.gameAssignment.findFirst({ where: { moduleId, live: true, gameId: { not: gameId }, game: { format: "QUIZ" } }, select: { game: { select: { title: true } } } });
      if (other) throw new StudioError(`This module already has a live quiz game (“${other.game.title}”). Switch that one off first.`, 409);
      try {
        await applyQuestSettings(moduleId, { practiceEnabled: true, enabledRewards: cleanRewards(game.enabledRewards) });
      } catch (e) {
        if (e instanceof QuestAdminError) throw new StudioError(e.message, e.status);
        throw e;
      }
    } else if (isItemFormat(game.format)) {
      const approved = await prisma.gameItem.count({ where: { moduleId, format: game.format, status: "APPROVED" } });
      if (approved === 0) throw new StudioError(`Approve at least one ${FORMAT_INFO[game.format].itemNoun} for this module before making the game live.`, 409);
    }
  } else if (existing?.live && game.format === "QUIZ") {
    await applyQuestSettings(moduleId, { practiceEnabled: false });
  }

  // Visitors can only try a game that is live, so switching it off closes it to them too.
  const wantOpen = wantLive && (opts.openToVisitors ?? existing?.openToVisitors ?? false);
  if (opts.openToVisitors && !wantLive) throw new StudioError("Make the game live before opening it to visitors.", 409);
  await prisma.gameAssignment.upsert({
    where: { gameId_moduleId: { gameId, moduleId } },
    create: { gameId, moduleId, live: wantLive, openToVisitors: wantOpen },
    update: { live: wantLive, openToVisitors: wantOpen },
  });
}

// ---------------------------------------------------------------------------
// Module workspace and items
// ---------------------------------------------------------------------------

export async function moduleWorkspace(moduleId: string) {
  const [quest, items, assignments] = await Promise.all([
    questSnapshot(moduleId),
    prisma.gameItem.findMany({
      where: { moduleId },
      orderBy: { createdAt: "asc" },
      select: { id: true, objectiveId: true, format: true, content: true, status: true, source: true },
    }),
    prisma.gameAssignment.findMany({ where: { moduleId }, select: { id: true, gameId: true, live: true, openToVisitors: true, game: { select: { title: true, format: true } } } }),
  ]);
  if (!quest.module) throw new StudioError("That module could not be found.", 404);
  return {
    module: quest.module,
    quest,
    items: items.map((i) => ({
      id: i.id,
      objectiveId: i.objectiveId,
      format: i.format,
      status: i.status,
      source: i.source,
      title: isItemFormat(i.format) ? itemTitle(i.format, i.content as unknown as ItemContent) : "",
      content: i.content,
    })),
    assignments: assignments.map((a) => ({ id: a.id, gameId: a.gameId, live: a.live, openToVisitors: a.openToVisitors, title: a.game.title, format: a.game.format })),
  };
}

export async function createItem(
  moduleId: string,
  input: { objectiveId: string; format: string; content: unknown; source: "LOOP" | "STAFF"; status?: "DRAFT" | "APPROVED" }
) {
  if (!isItemFormat(input.format)) throw new StudioError("Matching, ordering and scenario items only.", 400);
  const objective = await prisma.moduleLearningObjective.findFirst({ where: { id: input.objectiveId, moduleId }, select: { id: true } });
  if (!objective) throw new StudioError("That learning objective isn't part of this module.", 400);
  const valid = validateItemContent(input.format, input.content);
  if (!valid.ok) throw new StudioError(valid.error, 400);
  return prisma.gameItem.create({
    data: {
      moduleId,
      objectiveId: objective.id,
      format: input.format,
      content: valid.content as object,
      source: input.source,
      status: input.status ?? (input.source === "LOOP" ? "DRAFT" : "APPROVED"),
    },
    select: { id: true, status: true },
  });
}

export async function updateItem(moduleId: string, itemId: string, input: { content?: unknown; status?: "DRAFT" | "APPROVED" | "REJECTED" }, reviewerId: string) {
  const item = await prisma.gameItem.findFirst({ where: { id: itemId, moduleId }, select: { id: true, format: true } });
  if (!item) throw new StudioError("That item could not be found.", 404);
  const data: { content?: object; status?: "DRAFT" | "APPROVED" | "REJECTED"; reviewedById?: string; reviewedAt?: Date } = {};
  if (input.content !== undefined) {
    const valid = validateItemContent(item.format as ItemFormat, input.content);
    if (!valid.ok) throw new StudioError(valid.error, 400);
    data.content = valid.content as object;
    // Edited content must be looked at again.
    data.status = "DRAFT";
  }
  if (input.status) {
    data.status = input.status;
    data.reviewedById = reviewerId;
    data.reviewedAt = new Date();
  }
  await prisma.gameItem.update({ where: { id: itemId }, data });
}

export async function deleteItem(moduleId: string, itemId: string) {
  const item = await prisma.gameItem.findFirst({ where: { id: itemId, moduleId }, select: { id: true } });
  if (!item) throw new StudioError("That item could not be found.", 404);
  await prisma.gameItem.delete({ where: { id: itemId } });
  // A live game with nothing left to play goes back to waiting.
  await pauseGamesWithoutItems(moduleId);
}

/** Approves every draft of a format in a module (a person's decision, however it was triggered). */
export async function approveDrafts(moduleId: string, format: ItemFormat, reviewerId: string): Promise<number> {
  const r = await prisma.gameItem.updateMany({ where: { moduleId, format, status: "DRAFT" }, data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() } });
  return r.count;
}

async function pauseGamesWithoutItems(moduleId: string) {
  const live = await prisma.gameAssignment.findMany({ where: { moduleId, live: true, game: { format: { not: "QUIZ" } } }, select: { id: true, game: { select: { format: true } } } });
  for (const a of live) {
    const n = await prisma.gameItem.count({ where: { moduleId, format: a.game.format, status: "APPROVED" } });
    if (n === 0) await prisma.gameAssignment.update({ where: { id: a.id }, data: { live: false } });
  }
}

// ---------------------------------------------------------------------------
// Preview (no trainee, nothing recorded)
// ---------------------------------------------------------------------------

export interface PreviewServed {
  format: GameFormat;
  itemId: string;
  objective: string;
  /** For authors only: lets the preview label what is draft. */
  status: string;
  served: Served | { format: "QUIZ"; question: string; options: { key: string; text: string }[] };
  index: number;
  total: number;
}

/** Serves one item for preview. Drafts are included so authors can try them before approving. */
export async function previewServe(moduleId: string, format: GameFormat, index: number): Promise<PreviewServed | null> {
  if (format === "QUIZ") {
    const qs = await prisma.question.findMany({
      where: { exam: { moduleId }, bankStatus: "APPROVED", bankObjectiveId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, bankObjective: { select: { text: true } }, options: { select: { key: true, text: true, isCorrect: true }, orderBy: { order: "asc" } } },
    });
    const usable = qs.filter((q) => q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length === 1);
    if (usable.length === 0) return null;
    const q = usable[((index % usable.length) + usable.length) % usable.length];
    return {
      format,
      itemId: q.id,
      objective: q.bankObjective?.text ?? "",
      status: "APPROVED",
      served: { format: "QUIZ", question: q.text, options: shuffle(q.options.map((o) => ({ key: o.key, text: o.text }))) },
      index: ((index % usable.length) + usable.length) % usable.length,
      total: usable.length,
    };
  }
  if (!isItemFormat(format)) return null;
  const items = await prisma.gameItem.findMany({
    where: { moduleId, format, status: { not: "REJECTED" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, content: true, objective: { select: { text: true } } },
  });
  if (items.length === 0) return null;
  const i = ((index % items.length) + items.length) % items.length;
  const it = items[i];
  return { format, itemId: it.id, objective: it.objective.text, status: it.status, served: serveItem(format, it.content as unknown as ItemContent), index: i, total: items.length };
}

/** Grades a preview answer without recording anything. */
export async function previewGrade(moduleId: string, format: GameFormat, itemId: string, response: unknown) {
  if (format === "QUIZ") {
    const q = await prisma.question.findFirst({
      where: { id: itemId, exam: { moduleId } },
      select: { explanation: true, options: { select: { key: true, isCorrect: true } } },
    });
    const key = (response as { choice?: string } | null)?.choice;
    if (!q || typeof key !== "string") throw new StudioError("Choose an answer.", 400);
    const correct = q.options.find((o) => o.isCorrect)?.key ?? null;
    return { score: key === correct ? 1 : 0, correct: key === correct, feedback: { correctOptionKey: correct, explanation: q.explanation } };
  }
  if (!isItemFormat(format)) throw new StudioError("Unknown format.", 400);
  const item = await prisma.gameItem.findFirst({ where: { id: itemId, moduleId, format }, select: { content: true } });
  if (!item) throw new StudioError("That item could not be found.", 404);
  const graded = gradeItem(format, item.content as unknown as ItemContent, response);
  if (!graded) throw new StudioError("Complete your answer first.", 400);
  return graded;
}

// ---------------------------------------------------------------------------
// Trainee play
// ---------------------------------------------------------------------------

/** The live games a trainee can play in a module (quiz games link to practice mode). */
export async function liveGamesForTrainee(traineeId: string, moduleId: string) {
  await assertModuleReachable(traineeId, moduleId);
  const rows = await prisma.gameAssignment.findMany({
    where: { moduleId, live: true },
    orderBy: { createdAt: "asc" },
    select: { game: { select: { id: true, title: true, format: true, description: true } } },
  });
  const out: { id: string; title: string; format: GameFormat; description: string | null; items: number | null }[] = [];
  for (const r of rows) {
    const g = r.game;
    const items = g.format === "QUIZ" ? null : await prisma.gameItem.count({ where: { moduleId, format: g.format, status: "APPROVED" } });
    if (items === 0) continue;
    out.push({ id: g.id, title: g.title, format: g.format, description: g.description, items });
  }
  return out;
}

async function assertGameLive(traineeId: string, moduleId: string, gameId: string) {
  const mod = await assertModuleReachable(traineeId, moduleId);
  const a = await prisma.gameAssignment.findFirst({
    where: { gameId, moduleId, live: true },
    select: { game: { select: { id: true, title: true, format: true, enabledRewards: true } } },
  });
  if (!a || a.game.format === "QUIZ") throw new StudioError("This game isn't available for this module.", 404);
  return { module: mod, game: a.game };
}

const RESUME_MINUTES = 10;
const RECENT_MINUTES = 10;

export async function serveGameItem(traineeId: string, moduleId: string, gameId: string, now = new Date()) {
  const { game } = await assertGameLive(traineeId, moduleId, gameId);
  const format = game.format as ItemFormat;

  const respond = async (play: { id: string; itemId: string; servedAt: Date }) => {
    const item = await prisma.gameItem.findUnique({ where: { id: play.itemId }, select: { content: true, objective: { select: { text: true } } } });
    if (!item) return null;
    const content = item.content as unknown as ItemContent;
    return {
      playId: play.id,
      format,
      objective: item.objective.text,
      served: serveItem(format, content),
      minSeconds: minAnswerSeconds(itemText(format, content)),
    };
  };

  const pending = await prisma.gamePlay.findFirst({
    where: { traineeId, moduleId, gameId, answeredAt: null, servedAt: { gte: new Date(now.getTime() - RESUME_MINUTES * 60_000) }, item: { status: "APPROVED" } },
    orderBy: { servedAt: "desc" },
    select: { id: true, itemId: true, servedAt: true },
  });
  if (pending) {
    const r = await respond(pending);
    if (r) return r;
  }

  const items = await prisma.gameItem.findMany({ where: { moduleId, format, status: "APPROVED" }, select: { id: true, objectiveId: true } });
  if (items.length === 0) return null;
  const history = await prisma.gamePlay.findMany({
    where: { traineeId, moduleId, gameId, answeredAt: { not: null } },
    orderBy: { answeredAt: "asc" },
    select: { itemId: true, correct: true, answeredAt: true },
  });
  const last = new Map<string, { correct: boolean; at: number }>();
  for (const h of history) last.set(h.itemId, { correct: h.correct === true, at: (h.answeredAt as Date).getTime() });
  const cutoff = now.getTime() - RECENT_MINUTES * 60_000;
  const fresh = items.filter((i) => (last.get(i.id)?.at ?? 0) < cutoff);
  const pool = fresh.length > 0 ? fresh : items;
  // Unseen first, then ones last got wrong, then the least recently played.
  const rank = (i: { id: string }) => (!last.has(i.id) ? 0 : last.get(i.id)!.correct ? 2 : 1);
  const best = Math.min(...pool.map(rank));
  let tier = pool.filter((i) => rank(i) === best);
  if (best === 2) {
    const oldest = Math.min(...tier.map((i) => last.get(i.id)!.at));
    tier = tier.filter((i) => last.get(i.id)!.at === oldest);
  }
  const picked = tier[Math.floor(Math.random() * tier.length)];
  const play = await prisma.gamePlay.create({ data: { traineeId, moduleId, gameId, itemId: picked.id, objectiveId: picked.objectiveId, servedAt: now }, select: { id: true, itemId: true, servedAt: true } });
  return respond(play);
}

export async function answerGameItem(traineeId: string, moduleId: string, gameId: string, playId: string, response: unknown, now = new Date()) {
  const { game } = await assertGameLive(traineeId, moduleId, gameId);
  const format = game.format as ItemFormat;
  const enabled = new Set<RewardKind>(cleanRewards(game.enabledRewards));

  const play = await prisma.gamePlay.findFirst({
    where: { id: playId, traineeId, moduleId, gameId },
    select: { id: true, itemId: true, objectiveId: true, servedAt: true, answeredAt: true, score: true, correct: true, tooFast: true, item: { select: { content: true, status: true } } },
  });
  if (!play) throw new StudioError("That item isn't open any more.", 404);
  const content = play.item.content as unknown as ItemContent;
  const minSeconds = minAnswerSeconds(itemText(format, content));

  if (play.answeredAt) {
    const g = gradeItem(format, content, response);
    return { repeated: true as const, score: play.score ?? 0, correct: play.correct === true, tooFast: play.tooFast, minSeconds, feedback: g?.feedback ?? {} };
  }
  const graded = gradeItem(format, content, response);
  if (!graded) throw new StudioError("Complete your answer first.", 400);

  const secondsTaken = Math.max(0, Math.round((now.getTime() - play.servedAt.getTime()) / 1000));
  const tooFast = secondsTaken < minSeconds;
  const claimed = await prisma.gamePlay.updateMany({
    where: { id: play.id, answeredAt: null },
    data: { answeredAt: now, response: response as object, score: graded.score, correct: graded.correct, secondsTaken, tooFast },
  });
  if (claimed.count === 0) return { repeated: true as const, score: graded.score, correct: graded.correct, tooFast, minSeconds, feedback: graded.feedback };

  const today = dayKey(now);
  const prior = await prisma.gamePlay.findMany({ where: { traineeId, itemId: play.itemId, answeredAt: { not: null }, id: { not: play.id } }, select: { correct: true, answeredAt: true } });
  const wrongs = prior.filter((p) => p.correct === false);
  const [earnedToday, bonusPaid, todaySum] = await Promise.all([
    prisma.xpEntry.findUnique({ where: { dedupeKey: `GANSWER:${traineeId}:${play.itemId}:${today}` }, select: { id: true } }),
    prisma.xpEntry.findUnique({ where: { dedupeKey: `GMISSED:${traineeId}:${play.itemId}` }, select: { id: true } }),
    prisma.xpEntry.aggregate({ where: { traineeId, dayKey: today, kind: { in: ["ANSWER", "MISSED_BONUS"] } }, _sum: { points: true } }),
  ]);
  const award = xpForAnswer({
    correct: graded.correct,
    tooFast,
    hintUsed: false,
    wrongEarlierToday: wrongs.some((w) => dayKey(w.answeredAt as Date) === today),
    missedOnEarlierDay: wrongs.some((w) => dayKey(w.answeredAt as Date) < today),
    missedBonusPaid: !!bonusPaid,
    alreadyEarnedToday: !!earnedToday,
    answerXpToday: todaySum._sum.points ?? 0,
    enabled,
  });
  const base = { traineeId, moduleId, dayKey: today, objectiveId: play.objectiveId, questionId: play.itemId };
  const answerXp = await addXp({ ...base, kind: "ANSWER", points: award.answerPoints, dedupeKey: `GANSWER:${traineeId}:${play.itemId}:${today}` });
  const bonusXp = await addXp({ ...base, kind: "MISSED_BONUS", points: award.missedBonusPoints, dedupeKey: `GMISSED:${traineeId}:${play.itemId}` });
  // Game plays count toward streaks and mastery exactly like quiz answers: a full-marks, not-too-fast play is evidence.
  const { paid: streakPaid, streak } = await awardStreak(traineeId, moduleId, enabled, now, graded.correct && !tooFast);
  const settled = await settleMastery(traineeId, moduleId, play.objectiveId, enabled, now);
  const totals = await prisma.xpEntry.aggregate({ where: { traineeId, dayKey: today, kind: { in: ["ANSWER", "MISSED_BONUS"] } }, _sum: { points: true } });

  return {
    repeated: false as const,
    score: graded.score,
    correct: graded.correct,
    tooFast,
    minSeconds,
    feedback: graded.feedback,
    xp: {
      earned: answerXp + bonusXp + streakPaid + settled.objectiveXp + settled.moduleXp,
      streak: streakPaid,
      objective: settled.objectiveXp,
      module: settled.moduleXp,
      today: totals._sum.points ?? 0,
      dailyCap: QUEST_DEFAULTS.xp.dailyAnswerCap,
      cappedByDailyLimit: award.cappedByDailyLimit,
    },
    streakDays: streak,
    mastery: settled.mastery,
    objectiveJustMastered: settled.objectiveJustMastered,
    moduleCompleted: settled.moduleCompleted,
  };
}

export { ALL_REWARDS };
