/**
 * The question bank as one person works it inside the Game Studio: ask for questions, let a second Claude model check them,
 * then approve. Shared by the studio's routes and by Loop's actions so both follow the same rules.
 *
 *   write (writer model)  ->  review (a DIFFERENT reviewer model, automatic)  ->  one approval by a person  ->  live + split into pools
 *
 * Approving never touches a question the reviewer hasn't looked at, and flagged questions are never approved in bulk.
 */
import { prisma } from "@/lib/prisma";
import { bankModelInfo } from "@/lib/ai/bankModels";
import { applyReviewedTransition } from "@/lib/questionBank/transitions";
import { autoSplitPools } from "@/lib/quest/admin";
import { QUEST_DEFAULTS } from "@/lib/quest/core";
import { bucketOf, poolNeed, reasonsFromDetail, type BankBucket, type BankPool } from "@/lib/quest/bankCore";

export class BankError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function examIdFor(moduleId: string): Promise<string | null> {
  return (await prisma.exam.findUnique({ where: { moduleId }, select: { id: true } }))?.id ?? null;
}

export interface BankQuestionView {
  id: string;
  objectiveId: string | null;
  bucket: BankBucket;
  /** What it is for: games and practice, the assessment, or not chosen yet (older questions). */
  pool: BankPool | null;
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
      pool: r.bankPool,
      text: r.text,
      options: r.options,
      explanation: r.explanation,
      reasons: reasonsFromDetail(verdict.get(r.id)),
      reviewedBy: detail?.reviewedBy ?? null,
    };
  });

  const inBucket = (id: string, b: BankBucket, pool?: BankPool | null) =>
    generated.filter((r) => r.bankObjectiveId === id && bucketOf(r.bankStatus) === b && (pool === undefined || r.bankPool === pool)).length;
  const inPipeline = (id: string, pool: BankPool) => generated.filter((r) => r.bankObjectiveId === id && r.bankPool === pool && ["APPROVED", "AWAITING_REVIEW", "READY", "FLAGGED"].includes(bucketOf(r.bankStatus) as string)).length;
  const perObjective = objectives.map((o) => {
    const side = (pool: BankPool) => ({
      approved: inBucket(o.id, "APPROVED", pool),
      awaiting: inBucket(o.id, "AWAITING_REVIEW", pool),
      ready: inBucket(o.id, "READY", pool),
      flagged: inBucket(o.id, "FLAGGED", pool),
      need: poolNeed(pool, inPipeline(o.id, pool)),
    });
    const practice = side("PRACTICE");
    const formal = side("FORMAL");
    return {
      id: o.id,
      text: o.text,
      approved: inBucket(o.id, "APPROVED"),
      // Kept for Loop and older screens: approved per side.
      practice: practice.approved,
      formal: formal.approved,
      awaiting: inBucket(o.id, "AWAITING_REVIEW"),
      ready: inBucket(o.id, "READY"),
      flagged: inBucket(o.id, "FLAGGED"),
      need: practice.need + formal.need,
      sides: { PRACTICE: practice, FORMAL: formal },
      unassigned: generated.filter((r) => r.bankObjectiveId === o.id && r.bankPool === null && ["APPROVED", "AWAITING_REVIEW", "READY", "FLAGGED"].includes(bucketOf(r.bankStatus) as string)).length,
    };
  });

  // Approved questions, so the other side can borrow one on purpose.
  const approvedQuestions = generated
    .filter((r) => r.bankStatus === "APPROVED")
    .map((r) => ({ id: r.id, objectiveId: r.bankObjectiveId, pool: r.bankPool, text: r.text, options: r.options }));

  const total = (b: BankBucket) => questions.filter((q) => q.bucket === b).length;
  return {
    models: bankModelInfo(),
    minimums: QUEST_DEFAULTS.poolMinimum,
    objectives: perObjective,
    questions,
    approvedQuestions,
    legacyCount,
    totals: { awaiting: total("AWAITING_REVIEW"), ready: total("READY"), flagged: total("FLAGGED"), approved: generated.filter((r) => r.bankStatus === "APPROVED").length },
  };
}

async function reviewedQuestionsIn(moduleId: string, filter: { ids?: string[]; passedOnly?: boolean; pool?: BankPool }) {
  const examId = await examIdFor(moduleId);
  if (!examId) return [];
  const statuses = filter.passedOnly ? (["VALIDATED_PASS"] as const) : (["VALIDATED_PASS", "VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED"] as const);
  return prisma.question.findMany({
    where: { examId, bankStatus: { in: [...statuses] }, ...(filter.ids ? { id: { in: filter.ids } } : {}), ...(filter.pool ? { bankPool: filter.pool } : {}) },
    select: { id: true, bankStatus: true },
  });
}

/**
 * The person's approval. `allPassed` approves every question the reviewer passed and never a flagged one; `ids` approves exactly
 * those questions, flagged ones included (a deliberate choice for each). Approved questions are split into the practice and
 * formal pools straight away.
 */
export async function approveQuestions(moduleId: string, userId: string, input: { ids?: string[]; allPassed?: boolean; pool?: BankPool }) {
  if (!input.allPassed && !(input.ids && input.ids.length)) throw new BankError("Choose which questions to approve.");
  const rows = await reviewedQuestionsIn(moduleId, { ids: input.allPassed ? undefined : input.ids, passedOnly: !!input.allPassed, pool: input.allPassed ? input.pool : undefined });
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

/** Fixes a question's wording or options. A person is the reviewer: the edited question stays "passed review", waiting for approval. */
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
  await prisma.question.update({ where: { id }, data: { text, bankStatus: "VALIDATED_PASS", needsReview: true, reviewReason: "Edited by a person. Waiting for your approval." } });
  await prisma.questionBankEvent.create({ data: { questionId: id, fromStatus: q.bankStatus, toStatus: "VALIDATED_PASS", kind: "EDITED_IN_STUDIO", actedById: userId } });
  return { ok: true as const };
}

const LIVE_STATES = ["PENDING_REVIEW", "VALIDATED_PASS", "VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED", "APPROVED"] as const;

/** Chooses what questions are for: games and practice, or the assessment. For questions that have no purpose yet, or to move one. */
export async function assignQuestions(moduleId: string, userId: string, input: { ids?: string[]; allUnassigned?: boolean; pool: BankPool }) {
  const examId = await examIdFor(moduleId);
  if (!examId) return { assigned: 0 };
  if (!input.allUnassigned && !(input.ids && input.ids.length)) throw new BankError("Choose which questions to move.");
  const where = { examId, bankStatus: { in: [...LIVE_STATES] }, ...(input.allUnassigned ? { bankPool: null } : { id: { in: input.ids } }) };
  const rows = await prisma.question.findMany({ where, select: { id: true, bankStatus: true } });
  if (rows.length === 0) return { assigned: 0 };
  await prisma.question.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { bankPool: input.pool } });
  for (const r of rows) await prisma.questionBankEvent.create({ data: { questionId: r.id, fromStatus: r.bankStatus, toStatus: r.bankStatus ?? "APPROVED", kind: "POOL_ASSIGNED", note: input.pool === "PRACTICE" ? "Set for games and practice" : "Set for the assessment", actedById: userId } });
  return { assigned: rows.length };
}

/**
 * Lends an approved question to the other side on purpose: it becomes a separate, already-approved copy there, so editing or
 * retiring one never changes the other. A copy is skipped if that side already has a question with the same wording.
 */
export async function copyQuestions(moduleId: string, userId: string, input: { ids: string[]; to: BankPool }) {
  const examId = await examIdFor(moduleId);
  if (!examId) return { copied: 0, skipped: 0 };
  if (!input.ids.length) throw new BankError("Choose which questions to copy.");
  const rows = await prisma.question.findMany({
    where: { examId, id: { in: input.ids.slice(0, 50) }, bankStatus: "APPROVED", NOT: { bankPool: input.to } },
    select: { id: true, text: true, topic: true, explanation: true, bankObjectiveId: true, options: { select: { text: true, isCorrect: true, key: true, order: true } }, sourceMaterials: { select: { materialId: true } } },
  });
  const existing = new Set((await prisma.question.findMany({ where: { examId, bankPool: input.to, bankStatus: "APPROVED" }, select: { text: true } })).map((q) => q.text.trim().toLowerCase()));
  let copied = 0;
  let skipped = 0;
  for (const r of rows) {
    if (existing.has(r.text.trim().toLowerCase())) {
      skipped++;
      continue;
    }
    const made = await prisma.question.create({
      data: {
        examId,
        text: r.text,
        topic: r.topic,
        explanation: r.explanation,
        needsReview: false,
        bankStatus: "APPROVED",
        bankObjectiveId: r.bankObjectiveId,
        bankPool: input.to,
        options: { create: r.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, key: o.key, order: o.order })) },
        sourceMaterials: { create: r.sourceMaterials.map((m) => ({ materialId: m.materialId })) },
      },
    });
    await prisma.questionBankEvent.create({ data: { questionId: made.id, fromStatus: null, toStatus: "APPROVED", kind: "COPIED_TO_OTHER_SIDE", note: `Copied from question ${r.id}`, actedById: userId } });
    copied++;
  }
  skipped += Math.max(0, input.ids.length - rows.length);
  return { copied, skipped };
}
