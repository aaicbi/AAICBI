/**
 * The rules of the review team, with no database so they can be tested.
 * The super admin and the reviewers they appoint decide posts, appeals and
 * Loop's questions. A reviewer may escalate an unusual case to the super
 * admin, with a reason; once escalated, only a super admin may decide it.
 */
export type Reviewer = { isSuperAdmin: boolean };
export type ItemState = { escalatedAt: Date | null };

/** Who may decide an item right now. Escalated items are for the super admin alone. */
export function canDecide(reviewer: Reviewer, item: ItemState): boolean {
  if (reviewer.isSuperAdmin) return true;
  return item.escalatedAt === null;
}

/** Only a reviewer who is not a super admin has anyone to escalate to, and an item can be escalated once. */
export function canEscalate(reviewer: Reviewer, item: ItemState): boolean {
  return !reviewer.isSuperAdmin && item.escalatedAt === null;
}

/** Only a super admin may send an escalated item back to the reviewers. */
export function canReturn(reviewer: Reviewer, item: ItemState): boolean {
  return reviewer.isSuperAdmin && item.escalatedAt !== null;
}

export const NOTE_MIN = 5;
export const NOTE_MAX = 1000;

/** Escalating, declining and similar actions must say why. */
export function checkReason(note: unknown): { ok: true; note: string } | { ok: false; error: string } {
  const n = typeof note === "string" ? note.replace(/\s+/g, " ").trim() : "";
  if (n.length < NOTE_MIN) return { ok: false, error: "Give a short reason so the next person understands." };
  if (n.length > NOTE_MAX) return { ok: false, error: `Please keep the reason under ${NOTE_MAX} characters.` };
  return { ok: true, note: n };
}

export type QueueKind = "POST" | "APPEAL" | "LOOP";
export type QueueFilter = "all" | "posts" | "loop" | "appeals" | "escalated";
export const QUEUE_FILTERS: QueueFilter[] = ["all", "posts", "loop", "appeals", "escalated"];

export function parseFilter(raw: string | null | undefined): QueueFilter {
  return (QUEUE_FILTERS as string[]).includes(raw ?? "") ? (raw as QueueFilter) : "all";
}

export interface QueueEntry { kind: QueueKind; waitingSince: Date; escalated: boolean }

export function matchesFilter(e: QueueEntry, filter: QueueFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "posts": return e.kind === "POST";
    case "loop": return e.kind === "LOOP";
    case "appeals": return e.kind === "APPEAL";
    case "escalated": return e.escalated;
  }
}

/** Escalated items first (they are waiting on the one person who can decide them), then the longest-waiting. */
export function orderQueue<T extends QueueEntry>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.escalated) - Number(a.escalated) || a.waitingSince.getTime() - b.waitingSince.getTime());
}

export type AppealAction = "lift" | "uphold";
/** What an appeal decision does to the organization's hold. */
export function appealEffect(action: AppealAction): { clearsBlock: boolean } {
  return { clearsBlock: action === "lift" };
}

/** An organization may hold only the posts of its own trainees, and never the posts it wrote itself. */
export function orgMayBlock(input: { authorIsOrgTrainee: boolean; authorIsOrgItself: boolean }): boolean {
  return input.authorIsOrgTrainee && !input.authorIsOrgItself;
}
