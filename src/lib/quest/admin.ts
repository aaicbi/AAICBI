/**
 * Instructor-side Knowledge Quest operations, shared by the instructor page's
 * API route and by Loop's actions so both follow exactly the same rules
 * (including the "can't go live until both pools are big enough" check).
 */
import { prisma } from "@/lib/prisma";
import { ALL_REWARDS, QUEST_DEFAULTS, REWARD_LABELS, poolCoverage, suggestSplit } from "@/lib/quest/core";
import { cleanRewards, loadQuestSettings } from "@/lib/quest/server";

export async function questSnapshot(moduleId: string) {
  const [mod, objectives, questions, settings] = await Promise.all([
    prisma.module.findUnique({ where: { id: moduleId }, select: { id: true, title: true, courseId: true, course: { select: { title: true } } } }),
    prisma.moduleLearningObjective.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      select: { id: true, text: true, isCritical: true },
    }),
    prisma.question.findMany({
      where: { exam: { moduleId }, bankStatus: "APPROVED", bankObjectiveId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, bankObjectiveId: true, bankPool: true },
    }),
    loadQuestSettings(moduleId),
  ]);
  const coverage = poolCoverage(
    objectives.map((o) => o.id),
    questions.map((q) => ({ objectiveId: q.bankObjectiveId, pool: q.bankPool }))
  );
  return {
    module: mod ? { id: mod.id, title: mod.title, courseId: mod.courseId, courseTitle: mod.course.title } : null,
    settings,
    objectives: objectives.map((o) => ({
      ...o,
      coverage: coverage.objectives.find((c) => c.objectiveId === o.id),
      questions: questions
        .filter((q) => q.bankObjectiveId === o.id)
        .map((q) => ({ id: q.id, text: q.text.length > 140 ? `${q.text.slice(0, 140)}…` : q.text, pool: q.bankPool })),
    })),
    ready: coverage.ready,
    minimums: QUEST_DEFAULTS.poolMinimum,
    rewardOptions: ALL_REWARDS.map((k) => ({ kind: k, label: REWARD_LABELS[k] })),
  };
}

export interface QuestSettingsInput {
  practiceEnabled?: boolean;
  practiceBeforeFormal?: boolean;
  practiceRequiredPercent?: number;
  enabledRewards?: string[];
  criticalObjectiveIds?: string[];
}

export class QuestAdminError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Settings, rewards and required objectives. Throws QuestAdminError(409) if practice can't go live yet. */
export async function applyQuestSettings(moduleId: string, b: QuestSettingsInput) {
  if (b.practiceEnabled) {
    const snap = await questSnapshot(moduleId);
    if (!snap.ready) {
      throw new QuestAdminError(
        `Practice can go live once every objective has at least ${QUEST_DEFAULTS.poolMinimum.practice} approved practice questions and ${QUEST_DEFAULTS.poolMinimum.formal} approved formal questions.`,
        409
      );
    }
  }
  const data = {
    ...(b.practiceEnabled !== undefined ? { practiceEnabled: b.practiceEnabled } : {}),
    ...(b.practiceBeforeFormal !== undefined ? { practiceBeforeFormal: b.practiceBeforeFormal } : {}),
    ...(b.practiceRequiredPercent !== undefined ? { practiceRequiredPercent: b.practiceRequiredPercent } : {}),
    ...(b.enabledRewards !== undefined ? { enabledRewards: cleanRewards(b.enabledRewards) } : {}),
  };
  await prisma.moduleQuestSettings.upsert({ where: { moduleId }, create: { moduleId, ...data }, update: data });

  if (b.criticalObjectiveIds) {
    const mine = await prisma.moduleLearningObjective.findMany({ where: { moduleId }, select: { id: true } });
    const critical = new Set(b.criticalObjectiveIds);
    await prisma.$transaction(mine.map((o) => prisma.moduleLearningObjective.update({ where: { id: o.id }, data: { isCritical: critical.has(o.id) } })));
  }
}

export async function setQuestionPool(moduleId: string, questionIds: string[], pool: "PRACTICE" | "FORMAL" | null) {
  // Only this module's approved bank questions can be tagged.
  await prisma.question.updateMany({
    where: { id: { in: questionIds }, exam: { moduleId }, bankStatus: "APPROVED" },
    data: { bankPool: pool },
  });
}

/** Splits every untagged approved question between the pools. Returns how many were assigned. */
export async function autoSplitPools(moduleId: string): Promise<{ practice: number; formal: number }> {
  const snap = await questSnapshot(moduleId);
  let practice = 0;
  let formal = 0;
  for (const o of snap.objectives) {
    const untagged = o.questions.filter((q) => q.pool === null).map((q) => q.id);
    if (untagged.length === 0) continue;
    const split = suggestSplit(untagged, o.coverage?.practice ?? 0, o.coverage?.formal ?? 0);
    if (split.formal.length) await prisma.question.updateMany({ where: { id: { in: split.formal } }, data: { bankPool: "FORMAL" } });
    if (split.practice.length) await prisma.question.updateMany({ where: { id: { in: split.practice } }, data: { bankPool: "PRACTICE" } });
    formal += split.formal.length;
    practice += split.practice.length;
  }
  return { practice, formal };
}
