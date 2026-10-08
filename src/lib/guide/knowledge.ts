import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EntryInput } from "@/lib/guide/adminSchemas";
import { sanitizeLinks } from "@/lib/guide/links";
import { addVariant, findSimilar, tokenKeyOf } from "@/lib/guide/similarity";
import { bumpRole, cleanConfidence, cleanRole, featureOf, scrubContext, scrubPage, scrubRoute, strongerReason, type UnansweredReport } from "@/lib/guide/record";
import { scrubQuestion } from "@/lib/guide/scrub";

/**
 * The approved-knowledge workflow. A question Loop could not answer waits in
 * a queue; a person writes or approves the answer; only then does it become
 * something Loop can say. Every change to an answer is kept as a version.
 * Nothing a visitor types ever becomes an answer by itself.
 */
export const MAX_OPEN_UNANSWERED = 2000;
const SIMILAR_SCAN = 300;

type Tx = Prisma.TransactionClient;
export type Actor = { userId: string; name: string };

const entryData = (d: EntryInput) => ({
  question: d.question,
  answer: d.answer,
  links: d.links as Prisma.InputJsonValue,
  keywords: d.keywords,
  enabled: d.enabled,
  category: d.category,
  navHref: d.navHref,
  navLabel: d.navLabel,
  target: d.target,
  relatedQuestions: d.relatedQuestions,
  roles: d.roles,
});

async function snapshot(tx: Tx, entryId: string, version: number, action: string, actor: Actor, note?: string | null) {
  const e = await tx.guideEntry.findUniqueOrThrow({ where: { id: entryId } });
  await tx.guideEntryVersion.create({
    data: {
      entryId, version, action,
      question: e.question, answer: e.answer, links: (e.links ?? []) as Prisma.InputJsonValue, keywords: e.keywords,
      category: e.category, navHref: e.navHref, navLabel: e.navLabel, target: e.target, relatedQuestions: e.relatedQuestions, roles: e.roles, enabled: e.enabled,
      changedById: actor.userId, changedByName: actor.name, changeNote: note ?? null,
    },
  });
}

export async function createEntry(tx: Tx, d: EntryInput, actor: Actor, action = "CREATED") {
  const e = await tx.guideEntry.create({ data: { ...entryData(d), createdById: actor.userId, updatedById: actor.userId, version: 1 } });
  await snapshot(tx, e.id, 1, action, actor, d.changeNote);
  return e;
}

/** Saves an edit as the next version. The previous state stays in the history. */
export async function updateEntry(tx: Tx, id: string, d: EntryInput, actor: Actor) {
  const cur = await tx.guideEntry.findUnique({ where: { id }, select: { version: true, enabled: true } });
  if (!cur) return null;
  const version = cur.version + 1;
  const action = cur.enabled && !d.enabled ? "DISABLED" : !cur.enabled && d.enabled ? "ENABLED" : "UPDATED";
  await tx.guideEntry.update({ where: { id }, data: { ...entryData(d), version, updatedById: actor.userId } });
  await snapshot(tx, id, version, action, actor, d.changeNote);
  return version;
}

/** Brings an older version's content back as a new version (history is never rewritten). */
export async function restoreVersion(tx: Tx, id: string, version: number, actor: Actor) {
  const old = await tx.guideEntryVersion.findUnique({ where: { entryId_version: { entryId: id, version } } });
  const cur = await tx.guideEntry.findUnique({ where: { id }, select: { version: true } });
  if (!old || !cur) return null;
  const next = cur.version + 1;
  await tx.guideEntry.update({
    where: { id },
    data: {
      question: old.question, answer: old.answer, links: (old.links ?? []) as Prisma.InputJsonValue, keywords: old.keywords, enabled: old.enabled,
      category: old.category, navHref: old.navHref, navLabel: old.navLabel, target: old.target, relatedQuestions: old.relatedQuestions, roles: old.roles,
      version: next, updatedById: actor.userId,
    },
  });
  await snapshot(tx, id, next, "RESTORED", actor, `Restored version ${version}`);
  return next;
}

export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export type StatField = "answered" | "unanswered" | "lowConfidence" | "helpful" | "notHelpful" | "navigations" | "tours";

/** Adds one to today's counter for a kind of account. A counter only: no text, no identity. */
export async function bumpStat(role: string, field: StatField): Promise<void> {
  const day = dayKey();
  await prisma.guideDailyStat.upsert({
    where: { day_role: { day, role } },
    create: { day, role, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
}

/**
 * Remembers a question Loop could not (fully) answer. Questions that mean
 * the same thing are grouped into one row with a count, however they were
 * worded. Stores scrubbed words, the kind of account, the page it was asked
 * on (ids removed) and the last few things typed; never the person.
 * Returns false when the text is not worth keeping or the queue is full.
 */
export async function recordUnanswered(report: UnansweredReport): Promise<boolean> {
  const text = scrubQuestion(report.question);
  if (!text) return false;
  const tokenKey = tokenKeyOf(text);
  const role = cleanRole(report.role);
  const route = scrubRoute(report.route);
  const meta = {
    lastRole: role,
    lastRoute: route,
    lastPage: scrubPage(report.page),
    feature: featureOf(route),
    context: scrubContext(report.context) as Prisma.InputJsonValue,
    confidence: cleanConfidence(report.confidence),
    attempted: report.attempted ? scrubQuestion(report.attempted) : null,
  };

  const exact = await prisma.guideUnanswered.findUnique({ where: { text } });
  const similar =
    exact ??
    findSimilar(
      text,
      await prisma.guideUnanswered.findMany({
        where: { status: { in: ["OPEN", "IN_REVIEW", "ANSWERED"] } },
        orderBy: { lastAskedAt: "desc" },
        take: SIMILAR_SCAN,
        select: { id: true, tokenKey: true },
      }),
    );

  if (similar) {
    const row = await prisma.guideUnanswered.findUniqueOrThrow({ where: { id: similar.id } });
    await prisma.guideUnanswered.update({
      where: { id: row.id },
      data: {
        asked: { increment: 1 },
        lastAskedAt: new Date(),
        variants: addVariant(row.variants, text, row.text),
        roleCounts: bumpRole(row.roleCounts, role),
        reason: strongerReason(row.reason, report.reason),
        // An answered question asked again means the written answer is not being found: put it back in the queue.
        status: row.status === "ANSWERED" ? "OPEN" : undefined,
        reviewNote: row.status === "ANSWERED" ? "Asked again after it was answered: check the answer's wording and keywords." : undefined,
        ...meta,
        attempted: meta.attempted ?? row.attempted,
        confidence: meta.confidence ?? row.confidence,
      },
    });
    return true;
  }

  const open = await prisma.guideUnanswered.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } });
  if (open >= MAX_OPEN_UNANSWERED) return false;
  await prisma.guideUnanswered.create({ data: { text, tokenKey, reason: report.reason, roleCounts: bumpRole({}, role), ...meta } });
  return true;
}

/** Counts how many times a written answer was given (never who asked). */
export async function countServed(entryDbId: string): Promise<void> {
  await prisma.guideEntry.updateMany({ where: { id: entryDbId }, data: { served: { increment: 1 } } });
}

export const toLinks = sanitizeLinks;

import { requireRole } from "@/lib/auth/session";
import { priorityOf } from "@/lib/guide/priority";

/** The signed-in SUPER_ADMIN making a change, with the name that is kept in the history. */
export async function guideActor(): Promise<Actor> {
  const s = await requireRole("SUPER_ADMIN");
  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { name: true } });
  return { userId: s.userId, name: u?.name ?? "Super admin" };
}

export interface QueueRow {
  id: string;
  text: string;
  variants: string[];
  asked: number;
  status: string;
  reason: string;
  confidence: number | null;
  attempted: string | null;
  roleCounts: Record<string, number>;
  lastRole: string | null;
  lastRoute: string | null;
  lastPage: string | null;
  feature: string | null;
  context: string[];
  category: string | null;
  firstAskedAt: Date;
  lastAskedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  entryId: string | null;
  mergedIntoId: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  score: number;
}

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export function toQueueRow(u: {
  id: string; text: string; variants: string[]; asked: number; status: string; reason: string; confidence: number | null; attempted: string | null;
  roleCounts: unknown; lastRole: string | null; lastRoute: string | null; lastPage: string | null; feature: string | null; context: unknown; category: string | null;
  firstAskedAt: Date; lastAskedAt: Date; reviewedAt: Date | null; reviewNote: string | null; entryId: string | null; mergedIntoId: string | null;
}): QueueRow {
  const roleCounts = u.roleCounts && typeof u.roleCounts === "object" && !Array.isArray(u.roleCounts) ? (u.roleCounts as Record<string, number>) : {};
  const { level, score } = priorityOf({ asked: u.asked, lastAskedAt: u.lastAskedAt, roleCounts, text: u.text, reason: u.reason });
  const context = Array.isArray(u.context) ? (u.context as unknown[]).filter((c): c is string => typeof c === "string") : [];
  return { ...u, roleCounts, context, priority: level, score };
}

export function sortQueue(rows: QueueRow[]): QueueRow[] {
  return [...rows].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.score - a.score || b.lastAskedAt.getTime() - a.lastAskedAt.getTime());
}

/** Numbers for the overview: last 30 days of counters, the queue, the knowledge, and where people get stuck. */
export async function guideMetrics() {
  const since = dayKey(new Date(Date.now() - 29 * 24 * 3600 * 1000));
  const [stats, byStatus, openRows, entries, recentEntries, helpedEntries] = await Promise.all([
    prisma.guideDailyStat.findMany({ where: { day: { gte: since } } }),
    prisma.guideUnanswered.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.guideUnanswered.findMany({ where: { status: { in: ["OPEN", "IN_REVIEW"] } }, take: 500, orderBy: { asked: "desc" } }),
    prisma.guideEntry.count(),
    prisma.guideEntry.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }),
    prisma.guideEntry.findMany({ where: { served: { gt: 0 } }, orderBy: { served: "desc" }, take: 5, select: { id: true, question: true, served: true } }),
  ]);
  const sum = (f: "answered" | "unanswered" | "lowConfidence" | "helpful" | "notHelpful" | "navigations" | "tours") => stats.reduce((n, s) => n + s[f], 0);
  const answered = sum("answered");
  const unanswered = sum("unanswered");
  const lowConfidence = sum("lowConfidence");
  const total = answered + unanswered;
  const rows = sortQueue(openRows.map(toQueueRow));
  const featureCount = new Map<string, number>();
  for (const r of rows) if (r.feature) featureCount.set(r.feature, (featureCount.get(r.feature) ?? 0) + r.asked);
  const confidences = rows.map((r) => r.confidence).filter((c): c is number => c !== null);
  const status = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  return {
    days: 30,
    questions: total,
    answered,
    unanswered,
    lowConfidence,
    helpful: sum("helpful"),
    notHelpful: sum("notHelpful"),
    navigations: sum("navigations"),
    tours: sum("tours"),
    resolutionRate: total > 0 ? Math.round((answered / total) * 100) : null,
    averageOpenConfidence: confidences.length ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100 : null,
    queue: { open: status.OPEN ?? 0, inReview: status.IN_REVIEW ?? 0, answered: status.ANSWERED ?? 0, rejected: status.REJECTED ?? 0, merged: status.MERGED ?? 0, dismissed: status.DISMISSED ?? 0 },
    knowledge: { entries, addedThisWeek: recentEntries },
    topUnanswered: rows.slice(0, 5).map((r) => ({ id: r.id, text: r.text, asked: r.asked, priority: r.priority })),
    struggles: [...featureCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([feature, asked]) => ({ feature, asked })),
    mostUsedAnswers: helpedEntries,
  };
}
