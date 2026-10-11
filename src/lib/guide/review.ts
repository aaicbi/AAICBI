import { prisma } from "@/lib/prisma";
import { EntrySchema, type EntryInput } from "@/lib/guide/adminSchemas";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";
import { createEntry } from "@/lib/guide/knowledge";
import { canDecide, canEscalate, canReturn, checkReason } from "@/lib/review/reviewCore";

/**
 * Reviewing Loop's unanswered questions as a member of the review team.
 * A reviewer (or the super admin) can write the approved answer, decline the
 * question, or escalate it to the super admin. Every decision is logged with
 * who and why. Settings, the Claude consultant and AI guidance stay with the
 * super admin: nothing here touches them.
 */
export class LoopReviewError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type Actor = { userId: string; name: string; isSuperAdmin: boolean };
const WAITING = ["OPEN", "IN_REVIEW"] as const;

async function load(id: string) {
  const row = await prisma.guideUnanswered.findUnique({ where: { id } });
  if (!row) throw new LoopReviewError("Question not found.", 404);
  if (!(WAITING as readonly string[]).includes(row.status)) throw new LoopReviewError("That question was already dealt with.", 409);
  return row;
}

const log = (id: string, action: string, actor: Actor, note: string | null) =>
  prisma.reviewLog.create({ data: { kind: "GUIDE_QUESTION", itemId: id, action, actorId: actor.userId, actorName: actor.name, note } });

/** Approve the answer: it becomes part of what Loop knows, for everyone. */
export async function answerQuestion(id: string, input: unknown, actor: Actor): Promise<string> {
  const row = await load(id);
  if (!canDecide(actor, row)) throw new LoopReviewError("This question was escalated to a super admin, who will decide it.", 403);
  const parsed = EntrySchema.safeParse(input);
  if (!parsed.success) throw new LoopReviewError(parsed.error.issues[0]?.message ?? "Check the answer.", 400);
  if ((await prisma.guideEntry.count()) >= MAX_CUSTOM_ENTRIES) throw new LoopReviewError(`Loop can keep up to ${MAX_CUSTOM_ENTRIES} written answers.`, 409);
  const a: EntryInput = parsed.data;
  const related = [...a.relatedQuestions, ...row.variants.filter((v) => v !== a.question && !a.relatedQuestions.includes(v))].slice(0, 8);
  const entry = await prisma.$transaction(async (tx) => {
    const created = await createEntry(tx, { ...a, relatedQuestions: related, category: a.category ?? row.category, changeNote: a.changeNote || `Approved by ${actor.isSuperAdmin ? "a super admin" : "a reviewer"}: ${actor.name}` }, actor);
    await tx.guideUnanswered.update({ where: { id }, data: { status: "ANSWERED", entryId: created.id, reviewedAt: new Date(), reviewedById: actor.userId, escalatedAt: null, escalatedById: null, escalationNote: null } });
    return created;
  });
  await log(id, "ANSWERED", actor, a.question);
  return entry.id;
}

/** Decline a question the guide should not answer, with a reason. */
export async function rejectQuestion(id: string, note: unknown, actor: Actor): Promise<void> {
  const row = await load(id);
  if (!canDecide(actor, row)) throw new LoopReviewError("This question was escalated to a super admin, who will decide it.", 403);
  const r = checkReason(note);
  if (!r.ok) throw new LoopReviewError(r.error, 400);
  await prisma.guideUnanswered.update({ where: { id }, data: { status: "REJECTED", reviewNote: r.note, reviewedAt: new Date(), reviewedById: actor.userId, escalatedAt: null, escalatedById: null, escalationNote: null } });
  await log(id, "REJECTED", actor, r.note);
}

export async function escalateQuestion(id: string, note: unknown, actor: Actor): Promise<void> {
  const row = await load(id);
  if (!canEscalate(actor, row)) throw new LoopReviewError(actor.isSuperAdmin ? "You are the super admin: please decide it." : "This question is already escalated.", 409);
  const r = checkReason(note);
  if (!r.ok) throw new LoopReviewError(r.error, 400);
  await prisma.guideUnanswered.update({ where: { id }, data: { escalatedAt: new Date(), escalatedById: actor.userId, escalationNote: r.note } });
  await log(id, "ESCALATED", actor, r.note);
}

export async function returnQuestion(id: string, actor: Actor): Promise<void> {
  const row = await load(id);
  if (!canReturn(actor, row)) throw new LoopReviewError("Only a super admin can send an escalated question back.", 403);
  await prisma.guideUnanswered.update({ where: { id }, data: { escalatedAt: null, escalatedById: null, escalationNote: null } });
  await log(id, "RETURNED", actor, null);
}
