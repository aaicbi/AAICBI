/**
 * The question bank as one person works it inside the Game Studio: ask for questions, let a second Claude model check them,
 * then approve. Shared by the studio's routes and by Loop's actions so both follow the same rules.
 *
 *   write (writer model)  ->  review (a DIFFERENT reviewer model, automatic)  ->  one approval by a person  ->  live + split into pools
 *
 * Approving never touches a question the reviewer hasn't looked at, and flagged questions are never approved in bulk.
 */
import { prisma } from "@/lib/prisma";
import { bankModelInfo, BankModelError } from "@/lib/ai/bankModels";
import { generateBankQuestionBatch } from "@/lib/ai/generateBankQuestions";
import { reviewGeneratedQuestions } from "@/lib/ai/validateBankQuestions";
import { applyReviewedTransition } from "@/lib/questionBank/transitions";
import { autoSplitPools } from "@/lib/quest/admin";
import { QUEST_DEFAULTS } from "@/lib/quest/core";
import { bucketOf, questionsNeeded, reasonsFromDetail, type BankBucket } from "@/lib/quest/bankCore";

export class BankError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Largest number of questions written in one request: one writer batch, so it stays inside the function time limit. */
export const GENERATE_PER_REQUEST = 10;

async function examIdFor(moduleId: string): Promise<string | null> {
  return (await prisma.exam.findUnique({ where: { moduleId }, select: { id: true } }))?.id ?? null;
}

export interface BankQuestionView {
  id: string;
  objectiveId: string | null;
  bucket: BankBucket;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string | null;
  /** Why the reviewer flagged it, in plain words. Empty for a question that passed. */
  reasons: string[];
  reviewedBy: string | null;
}

export async function bankOverview(moduleId: string) {
  const examId = await examIdFor(moduleId);
  const objectives = await prisma.moduleLearningObjective.findMany({ where: { moduleId }, orderBy: { order: "asc" }, select: { id: true, text: true } });
  const rows = examId
    ? await prisma.question.findMany({
        where: { examId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          text: true,
          explanation: true,
          bankStatus: true,
          bankObjectiveId: true,
          bankPool: true,
          options: { select: { text: true, isCorrect: true }, orderBy: { key: "asc" } },
        },
      })
    : [];

  const generated = rows.filter((r) => r.bankStatus !== null);
  const legacyCount = rows.length - generated.length;
  const reviewable = generated.filter((r) => {
    const b = bucketOf(r.bankStatus);
    return b === "AWAITING_REVIEW" || b === "READY" || b === "FLAGGED";
  });

  // The reviewer's latest stored verdict per question.
  const events = reviewable.length
    ? await prisma.questionBankEvent.findMany({
        where: { questionId: { in: reviewable.map((r) => r.id) } },
        orderBy: { createdAt: "desc" },
        select: { questionId: true, detail: true },
      })
    : [];
  const verdict = new Map<string, unknown>();
  for (const e of events) if (e.detail && !verdict.has(e.questionId)) verdict.set(e.questionId, e.detail);

  const questions: BankQuestionView[] = reviewable.map((r) => {
    const detail = verdict.get(r.id) as { reviewedBy?: string } | undefined;
    return {
      id: r.id,
      objectiveId: r.bankObjectiveId,
      bucket: bucketOf(r.bankStatus) as BankBucket,
      text: r.text,
      options: r.options,
      explanation: r.explanation,
      reasons: reasonsFromDetail(verdict.get(r.id)),
      reviewedBy: detail?.reviewedBy ?? null,
    };
  });

  const count = (id: string, b: BankBucket) => generated.filter((r) => r.bankObjectiveId === id && bucketOf(r.bankStatus) === b).length;
  const perObjective = objectives.map((o) => {
    const approved = count(o.id, "APPROVED");
    const awaiting = count(o.id, "AWAITING_REVIEW");
    const ready = count(o.id, "READY");
    const flagged = count(o.id, "FLAGGED");
    return {
      id: o.id,
      text: o.text,
      approved,
      practice: generated.filter((r) => r.bankObjectiveId === o.id && bucketOf(r.bankStatus) === "APPROVED" && r.bankPool === "PRACTICE").length,
      formal: generated.filter((r) => r.bankObjectiveId === o.id && bucketOf(r.bankStatus) === "APPROVED" && r.bankPool === "FORMAL").length,
      awaiting,
      ready,
      flagged,
      need: questionsNeeded(approved + awaiting + ready + flagged),
    };
  });

  const total = (b: BankBucket) => questions.filter((q) => q.bucket === b).length;
  return {
    models: bankModelInfo(),
    minimums: QUEST_DEFAULTS.poolMinimum,
    objectives: perObjective,
    questions,
    legacyCount,
    totals: { awaiting: total("AWAITING_REVIEW"), ready: total("READY"), flagged: total("FLAGGED"), approved: generated.filter((r) => r.bankStatus === "APPROVED").length },
  };
}

/** Writes up to GENERATE_PER_REQUEST questions for one learning objective. */
export async function generateQuestions(moduleId: string, userId: string, input: { objectiveId: string; count: number }) {
  const count = Math.max(1, Math.min(Math.floor(input.count) || 1, GENERATE_PER_REQUEST));
  try {
    return await generateBankQuestionBatch(moduleId, input.objectiveId, userId, count);
  } catch (e) {
    if (e instanceof BankModelError) throw new BankError(e.message, 503);
    throw new BankError(e instanceof Error ? e.message : "Writing the questions failed.", 409);
  }
}

/** Has the reviewer model check the next batch of freshly written questions. Call again while `remaining` is above zero. */
export async function reviewQuestions(moduleId: string, scope: { objectiveId?: string } = {}) {
  try {
    return await reviewGeneratedQuestions(moduleId, 10, scope);
  } catch (e) {
    if (e instanceof BankModelError) throw new BankError(e.message, 503);
    throw e;
  }
}

async function reviewedQuestionsIn(moduleId: string, filter: { ids?: string[]; passedOnly?: boolean }) {
  const examId = await examIdFor(moduleId);
  if (!examId) return [];
  const statuses = filter.passedOnly ? (["VALIDATED_PASS"] as const) : (["VALIDATED_PASS", "VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED"] as const);
  return prisma.question.findMany({
    where: { examId, bankStatus: { in: [...statuses] }, ...(filter.ids ? { id: { in: filter.ids } } : {}) },
    select: { id: true, bankStatus: true },
  });
}

/**
 * The person's approval. `allPassed` approves every question the reviewer passed and never a flagged one; `ids` approves exactly
 * those questions, flagged ones included (a deliberate choice for each). Approved questions are split into the practice and
 * formal pools straight away.
 */
export async function approveQuestions(moduleId: string, userId: string, input: { ids?: string[]; allPassed?: boolean }) {
  if (!input.allPassed && !(input.ids && input.ids.length)) throw new BankError("Choose which questions to approve.");
  const rows = await reviewedQuestionsIn(moduleId, { ids: input.allPassed ? undefined : input.ids, passedOnly: !!input.allPassed });
  let approved = 0;
  for (const r of rows) {
    const next = applyReviewedTransition(r.bankStatus, "approve");
    if (next !== "APPROVED") continue;
    await prisma.question.update({ where: { id: r.id }, data: { bankStatus: "APPROVED", needsReview: false, reviewReason: null } });
    await prisma.questionBankEvent.create({ data: { questionId: r.id, fromStatus: r.bankStatus, toStatus: "APPROVED", kind: "STUDIO_APPROVED", actedById: userId } });
    approved++;
  }
  const split = approved > 0 ? await autoSplitPools(moduleId) : { practice: 0, formal: 0 };
  return { approved, skipped: input.ids && !input.allPassed ? Math.max(0, input.ids.length - approved) : 0, split };
}

export async function rejectQuestions(moduleId: string, userId: string, ids: string[]) {
  if (!ids.length) throw new BankError("Choose which questions to reject.");
  const examId = await examIdFor(moduleId);
  if (!examId) return { rejected: 0 };
  const rows = await prisma.question.findMany({ where: { examId, id: { in: ids }, bankStatus: { in: ["PENDING_REVIEW", "VALIDATED_PASS", "VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED"] } }, select: { id: true, bankStatus: true } });
  for (const r of rows) {
    await prisma.question.update({ where: { id: r.id }, data: { bankStatus: "REJECTED" } });
    await prisma.questionBankEvent.create({ data: { questionId: r.id, fromStatus: r.bankStatus, toStatus: "REJECTED", kind: "STUDIO_REJECTED", actedById: userId } });
  }
  return { rejected: rows.length };
}

/** Fixes a question's wording or options, then has the reviewer look at it again. */
export async function editQuestion(moduleId: string, userId: string, id: string, input: { text: string; options: { text: string; isCorrect: boolean }[] }) {
  const text = input.text.trim();
  const options = input.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })).filter((o) => o.text);
  if (text.length < 3) throw new BankError("The question needs some text.");
  if (options.length < 2 || options.length > 6) throw new BankError("Give two to six options.");
  if (options.filter((o) => o.isCorrect).length !== 1) throw new BankError("Mark exactly one option as correct.");
  const examId = await examIdFor(moduleId);
  const q = examId ? await prisma.question.findFirst({ where: { id, examId, bankStatus: { in: ["PENDING_REVIEW", "VALIDATED_PASS", "VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED"] } }, select: { id: true, bankStatus: true } }) : null;
  if (!q) throw new BankError("That question can't be edited right now.", 404);
  await prisma.option.deleteMany({ where: { questionId: id } });
  await prisma.option.createMany({ data: options.map((o, i) => ({ questionId: id, text: o.text, isCorrect: o.isCorrect, key: String.fromCharCode(65 + i), order: i })) });
  await prisma.question.update({ where: { id }, data: { text, bankStatus: "PENDING_REVIEW", needsReview: true, reviewReason: "Edited. Being reviewed again." } });
  await prisma.questionBankEvent.create({ data: { questionId: id, fromStatus: q.bankStatus, toStatus: "PENDING_REVIEW", kind: "EDITED_IN_STUDIO", actedById: userId } });
  try {
    await reviewGeneratedQuestions(moduleId, 1, { questionIds: [id] });
  } catch (e) {
    if (e instanceof BankModelError) throw new BankError(`Saved, but the review couldn't run: ${e.message}`, 503);
    throw e;
  }
  return { ok: true as const };
}
