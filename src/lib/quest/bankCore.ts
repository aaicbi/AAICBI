/**
 * The question bank as the studio shows it: pure helpers that turn the bank's statuses and the reviewer's stored verdict into
 * plain words, and work out how many more questions a module needs. No database here, so it can be tested directly.
 */
import type { QuestionBankStatus } from "@prisma/client";
import { QUEST_DEFAULTS } from "@/lib/quest/core";

/**
 * Where a generated question is in front of the person:
 *  AWAITING_REVIEW  written, not yet checked by the reviewer model
 *  READY            the reviewer found nothing wrong: waiting for approval
 *  FLAGGED          the reviewer found a problem: needs a decision (approve anyway, edit, or reject)
 *  APPROVED         live in the bank
 *  REJECTED         thrown out (kept only for the audit trail)
 */
export type BankBucket = "AWAITING_REVIEW" | "READY" | "FLAGGED" | "APPROVED" | "REJECTED";

/** null = not a generated bank question at all (an older imported or hand-written one). */
export function bucketOf(status: QuestionBankStatus | null): BankBucket | null {
  switch (status) {
    case null:
      return null;
    case "PENDING_REVIEW":
    case "PENDING_VALIDATION":
      return "AWAITING_REVIEW";
    case "VALIDATED_PASS":
      return "READY";
    case "VALIDATED_WARNING":
    case "VALIDATED_FLAGGED":
    case "VALIDATED_REJECTED":
      return "FLAGGED";
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
  }
}

const LETTERS = "ABCDEFGH";

interface VerdictDetail {
  correctness?: { agrees?: boolean; verifiedOptionIndex?: number | null; originalOptionIndex?: number };
  alignment?: { aligned?: boolean; reason?: string | null };
  ambiguity?: { ambiguous?: boolean; reason?: string | null };
  duplicate?: { matchedQuestionText?: string; similarity?: number } | null;
}

/** The reviewer's stored verdict in plain words, one short sentence per concern. Empty when it found nothing wrong. */
export function reasonsFromDetail(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const d = detail as VerdictDetail;
  const out: string[] = [];
  if (d.correctness && d.correctness.agrees === false) {
    const idx = d.correctness.verifiedOptionIndex;
    out.push(
      typeof idx === "number" && idx >= 0 && idx < LETTERS.length
        ? `The reviewer worked out a different answer from the lesson material (it chose option ${LETTERS[idx]}). The marked answer may be wrong.`
        : "The reviewer could not confirm which answer is correct from the lesson material."
    );
  }
  if (d.alignment && d.alignment.aligned === false) out.push(d.alignment.reason?.trim() || "It doesn't really test the learning objective.");
  if (d.ambiguity && d.ambiguity.ambiguous === true) out.push(d.ambiguity.reason?.trim() || "More than one option could be defended as correct.");
  if (d.duplicate) {
    const text = d.duplicate.matchedQuestionText?.trim();
    out.push(text ? `It looks too much like an existing question: “${text.length > 120 ? `${text.slice(0, 120)}…` : text}”` : "It looks too much like an existing question.");
  }
  return out;
}

/** How many more questions an objective needs so both pools can reach their minimum, counting everything already in the pipeline. */
export function questionsNeeded(inPipeline: number, minimums: { practice: number; formal: number } = QUEST_DEFAULTS.poolMinimum): number {
  return Math.max(0, minimums.practice + minimums.formal - inPipeline);
}

export type BankPool = "PRACTICE" | "FORMAL";

/** What each side of the bank is for, in the words people see. */
export const POOL_LABEL: Record<BankPool, string> = { PRACTICE: "Games and practice", FORMAL: "Assessment" };

/** How many more questions one side of the bank needs for one objective, counting everything already written for that side. */
export function poolNeed(pool: BankPool, inPipeline: number, minimums: { practice: number; formal: number } = QUEST_DEFAULTS.poolMinimum): number {
  return Math.max(0, (pool === "PRACTICE" ? minimums.practice : minimums.formal) - inPipeline);
}
