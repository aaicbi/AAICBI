/**
 * Tidying a module's objectives after content has been imported: merge one objective into another, remove an empty one, and fill the
 * assessment side from spare practice questions. None of these asks Claude for anything; they only move what is already there.
 */
import { prisma } from "@/lib/prisma";
import { QUEST_DEFAULTS } from "@/lib/quest/core";
import { spreadPicks } from "@/lib/quest/contentImport";

export class TidyError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function inModule(moduleId: string, ids: string[]) {
  const found = await prisma.moduleLearningObjective.findMany({ where: { moduleId, id: { in: ids } }, select: { id: true, isCritical: true, text: true } });
  if (found.length !== new Set(ids).size) throw new TidyError("That objective isn't part of this module.", 404);
  return found;
}

/** Moves everything from one objective into another (questions, game items, and any trainee answers), then removes the empty one. */
export async function mergeObjective(moduleId: string, fromId: string, toId: string) {
  if (fromId === toId) throw new TidyError("Choose a different objective to merge into.");
  const [from, to] = await inModule(moduleId, [fromId, toId]).then((l) => [l.find((x) => x.id === fromId)!, l.find((x) => x.id === toId)!]);
  const moved = await prisma.$transaction(async (tx) => {
    const questions = await tx.question.updateMany({ where: { bankObjectiveId: fromId, exam: { moduleId } }, data: { bankObjectiveId: toId } });
    const items = await tx.gameItem.updateMany({ where: { objectiveId: fromId, moduleId }, data: { objectiveId: toId } });
    await tx.practiceAnswer.updateMany({ where: { objectiveId: fromId, moduleId }, data: { objectiveId: toId } });
    await tx.gamePlay.updateMany({ where: { objectiveId: fromId, moduleId }, data: { objectiveId: toId } });
    if (from.isCritical && !to.isCritical) await tx.moduleLearningObjective.update({ where: { id: toId }, data: { isCritical: true } });
    await tx.moduleLearningObjective.delete({ where: { id: fromId } });
    return { questions: questions.count, items: items.count };
  });
  return { ...moved, removed: from.text };
}

/** Removes an objective that has nothing attached. Refuses if it holds questions, items or any trainee's answers, so nothing is lost. */
export async function deleteEmptyObjective(moduleId: string, id: string) {
  const [o] = await inModule(moduleId, [id]);
  const [questions, items, answers, plays] = await Promise.all([
    prisma.question.count({ where: { bankObjectiveId: id } }),
    prisma.gameItem.count({ where: { objectiveId: id } }),
    prisma.practiceAnswer.count({ where: { objectiveId: id } }),
    prisma.gamePlay.count({ where: { objectiveId: id } }),
  ]);
  if (questions + items + answers + plays > 0) throw new TidyError("That objective still has questions or items. Merge it into another objective instead.", 409);
  await prisma.moduleLearningObjective.delete({ where: { id } });
  return { removed: o.text };
}

const LIVE = ["APPROVED", "VALIDATED_PASS"] as const;

/**
 * Brings every objective up to the assessment minimum by moving spare practice questions across (spread through the set), never taking an
 * objective's practice side below its own minimum. Approved stays approved. Returns what moved and which objectives are still short.
 */
export async function fillAssessmentSide(moduleId: string) {
  const need = QUEST_DEFAULTS.poolMinimum;
  const objectives = await prisma.moduleLearningObjective.findMany({ where: { moduleId }, orderBy: { order: "asc" }, select: { id: true, text: true } });
  const rows = await prisma.question.findMany({
    where: { exam: { moduleId }, bankObjectiveId: { not: null }, bankStatus: { in: [...LIVE] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, bankObjectiveId: true, bankPool: true },
  });
  const report: { objective: string; moved: number; practice: number; formal: number; stillShort: boolean }[] = [];
  let movedTotal = 0;
  for (const o of objectives) {
    const mine = rows.filter((r) => r.bankObjectiveId === o.id);
    const practice = mine.filter((r) => r.bankPool === "PRACTICE" || r.bankPool === null);
    const formal = mine.filter((r) => r.bankPool === "FORMAL").length;
    const lack = Math.max(0, need.formal - formal);
    const spare = Math.max(0, practice.length - need.practice);
    const n = Math.min(lack, spare);
    const picks = spreadPicks(practice.length, n).map((i) => practice[i].id);
    if (picks.length > 0) await prisma.question.updateMany({ where: { id: { in: picks } }, data: { bankPool: "FORMAL" } });
    movedTotal += picks.length;
    const practiceNow = practice.length - picks.length;
    const formalNow = formal + picks.length;
    report.push({ objective: o.text, moved: picks.length, practice: practiceNow, formal: formalNow, stillShort: formalNow < need.formal || practiceNow < need.practice });
  }
  return { moved: movedTotal, report };
}
