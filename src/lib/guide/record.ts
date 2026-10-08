import type { MeKind } from "@/lib/guide/context";
import { scrubQuestion } from "@/lib/guide/scrub";

/** What the browser tells the server about a question Loop could not (fully) answer. Everything is scrubbed again on the server. */
export type UnansweredReason = "NO_MATCH" | "LOW_CONFIDENCE" | "NOT_HELPFUL";

export interface UnansweredReport {
  question: string;
  reason: UnansweredReason;
  confidence?: number;
  attempted?: string;
  role?: string;
  route?: string;
  page?: string;
  context?: string[];
}

export const ROLE_VALUES: ReadonlyArray<MeKind | "visitor"> = ["trainee", "employer", "investor", "organization", "staff", "visitor"];

export function cleanRole(role: unknown): MeKind | "visitor" {
  return ROLE_VALUES.includes(role as MeKind) ? (role as MeKind | "visitor") : "visitor";
}

/** A page address with the query, the hash and anything that looks like an id removed. */
export function scrubRoute(route: unknown): string | null {
  if (typeof route !== "string") return null;
  const path = route.split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/") || path.length > 300) return null;
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((seg) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^c[a-z0-9]{20,}$/i.test(seg) || /^\d{3,}$/.test(seg) || /^[a-z0-9_-]{24,}$/i.test(seg) ? "[id]" : seg.slice(0, 40)));
  return "/" + parts.join("/").slice(0, 120);
}

/** The part of the product a route belongs to, for grouping ("trainee/messages"). */
export function featureOf(route: string | null): string | null {
  if (!route) return null;
  const parts = route.split("/").filter((p) => p && p !== "[id]");
  if (parts.length === 0) return "home";
  return parts.slice(0, 2).join("/");
}

export function scrubPage(page: unknown): string | null {
  return typeof page === "string" ? scrubQuestion(page)?.slice(0, 80) ?? null : null;
}

/** The last few things the person typed before this, scrubbed, newest last. */
export function scrubContext(context: unknown): string[] {
  if (!Array.isArray(context)) return [];
  return context.map((c) => (typeof c === "string" ? scrubQuestion(c) : null)).filter((c): c is string => !!c).slice(-3);
}

export function cleanConfidence(c: unknown): number | null {
  return typeof c === "number" && Number.isFinite(c) ? Math.max(0, Math.min(1, Math.round(c * 100) / 100)) : null;
}

const STRENGTH: Record<UnansweredReason, number> = { NO_MATCH: 3, LOW_CONFIDENCE: 2, NOT_HELPFUL: 1 };
/** Of two reasons for the same topic, the stronger one stays. */
export function strongerReason(a: string, b: string): UnansweredReason {
  const sa = STRENGTH[a as UnansweredReason] ?? 0;
  const sb = STRENGTH[b as UnansweredReason] ?? 0;
  return (sa >= sb ? a : b) as UnansweredReason;
}

/** Adds one to a kind of account's count. */
export function bumpRole(counts: unknown, role: string): Record<string, number> {
  const base = counts && typeof counts === "object" && !Array.isArray(counts) ? { ...(counts as Record<string, number>) } : {};
  base[role] = (typeof base[role] === "number" ? base[role] : 0) + 1;
  return base;
}
