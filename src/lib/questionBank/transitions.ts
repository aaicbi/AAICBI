/**
 * Loop Question Bank — the legal status-transition rules for the two
 * human review gates, as a pure, Prisma-free function so the rules
 * themselves are unit-testable without a database. Returns null for
 * an illegal transition (e.g. approving a question that isn't
 * actually awaiting that gate) — callers should treat that as a
 * conflict, never silently proceed.
 */
import type { QuestionBankStatus } from "@prisma/client";

export type GateAction = "approve" | "reject";

/** Gate 1: only legal from PENDING_REVIEW, the status generation itself sets. */
export function applyGate1Transition(current: QuestionBankStatus | null, action: GateAction): QuestionBankStatus | null {
  if (current !== "PENDING_REVIEW") return null;
  return action === "approve" ? "PENDING_VALIDATION" : "REJECTED";
}

/**
 * Gate 2: only legal from one of the three non-PASS validated statuses
 * — VALIDATED_PASS itself is never a legal gate-2 input, since a clean
 * pass auto-promotes straight to APPROVED and never reaches this gate
 * at all (see validateBankQuestions.ts).
 */
export function applyGate2Transition(current: QuestionBankStatus | null, action: GateAction): QuestionBankStatus | null {
  if (current !== "VALIDATED_WARNING" && current !== "VALIDATED_FLAGGED" && current !== "VALIDATED_REJECTED") {
    return null;
  }
  return action === "approve" ? "APPROVED" : "REJECTED";
}

/**
 * The single approval a person gives after the AI review (studio route). Legal from any reviewed status, a clean pass
 * included: that is the whole point of this route, since the review ran before a person looked and a clean pass waits for them.
 * (Gate 2 above stays as it was for the older route, where a clean pass goes live by itself.)
 */
export function applyReviewedTransition(current: QuestionBankStatus | null, action: GateAction): QuestionBankStatus | null {
  if (current !== "VALIDATED_PASS" && current !== "VALIDATED_WARNING" && current !== "VALIDATED_FLAGGED" && current !== "VALIDATED_REJECTED") {
    return null;
  }
  return action === "approve" ? "APPROVED" : "REJECTED";
}
