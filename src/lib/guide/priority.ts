/**
 * Which unanswered questions the team should deal with first. A question
 * rises with how often it is asked, how many kinds of account ask it, how
 * recently, and whether it touches something that matters to the business
 * (paying, applying, signing in, certificates, messaging). Pure arithmetic.
 */
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface PriorityInput {
  asked: number;
  lastAskedAt: Date | number;
  roleCounts: Record<string, number>;
  text: string;
  reason?: string;
}

const BUSINESS = new Set(["apply", "application", "pay", "payment", "paid", "login", "password", "certificate", "enroll", "enrol", "register", "message", "chat", "job", "refund", "publish", "approve", "verify"]);
const DAY = 24 * 3600 * 1000;
export const HIGH_AT = 60;
export const MEDIUM_AT = 20;

export function priorityOf(q: PriorityInput, now: number = Date.now()): { score: number; level: Priority } {
  const last = typeof q.lastAskedAt === "number" ? q.lastAskedAt : q.lastAskedAt.getTime();
  const age = Math.max(0, now - last);
  const kinds = Object.values(q.roleCounts).filter((n) => n > 0).length;
  const words = q.text.toLowerCase().split(/[^a-z]+/);
  let score = q.asked * 3 + Math.max(0, kinds - 1) * 4;
  score += age <= 7 * DAY ? 4 : age <= 30 * DAY ? 2 : 0;
  if (words.some((w) => BUSINESS.has(w))) score += 5;
  if (q.reason === "NOT_HELPFUL") score += 2;
  return { score, level: score >= HIGH_AT ? "HIGH" : score >= MEDIUM_AT ? "MEDIUM" : "LOW" };
}
