import { validateHandle } from "@/lib/profiles/handleCore";

/**
 * Rules for asking to change a handle (no database, so they can be tested).
 * A handle is a person's public address, so changes are requested with a
 * reason and decided by a super admin; the rules here only decide whether a
 * request is well formed.
 */
export const REASON_MIN = 10;
export const REASON_MAX = 500;
export const DECISION_NOTE_MAX = 300;

export type RequestCheck = { ok: true; handle: string; reason: string } | { ok: false; error: string };

export function checkRequestInput(input: { handle: unknown; reason: unknown }, currentHandle: string): RequestCheck {
  const v = validateHandle(input.handle);
  if (!v.ok) return v;
  if (v.handle === currentHandle) return { ok: false, error: "That is already your handle." };
  const reason = typeof input.reason === "string" ? input.reason.replace(/\s+/g, " ").trim() : "";
  if (reason.length < REASON_MIN) return { ok: false, error: `Please tell us why you want the change (at least ${REASON_MIN} characters).` };
  if (reason.length > REASON_MAX) return { ok: false, error: `Please keep the reason under ${REASON_MAX} characters.` };
  return { ok: true, handle: v.handle, reason };
}

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export const REQUEST_STATUSES: RequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

/** A rejection must say why, so the person can try again with a better choice. */
export function checkDecision(action: "approve" | "reject", note: unknown): { ok: true; note: string | null } | { ok: false; error: string } {
  const n = typeof note === "string" ? note.trim().slice(0, DECISION_NOTE_MAX) : "";
  if (action === "reject" && n.length < 5) return { ok: false, error: "Say why the request is declined, so the person knows what to change." };
  return { ok: true, note: n || null };
}

/** Only a pending request can be decided or cancelled. */
export const isOpen = (status: string) => status === "PENDING";
