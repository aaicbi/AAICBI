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
