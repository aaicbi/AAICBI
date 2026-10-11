import { prisma } from "@/lib/prisma";
import { postViews, type PostView } from "@/lib/posts/posts";
import { REPORT_LABEL, type ReportReason } from "@/lib/posts/interactionCore";
import { sortQueue, toQueueRow } from "@/lib/guide/knowledge";
import { cardsFor } from "@/lib/profiles/card";
import { matchesFilter, orderQueue, type QueueFilter } from "@/lib/review/reviewCore";

/** One place for everything waiting on the review team: posts, appeals of organization holds, and Loop's questions. */
interface Base { id: string; waitingSince: string; escalated: boolean; escalationNote: string | null; escalatedByName: string | null }
export type QueueItem =
  | (Base & { kind: "POST"; post: PostView; history: Array<{ action: string; actorName: string | null; note: string | null; createdAt: string }> })
  | (Base & { kind: "APPEAL"; post: PostView; orgBlockReason: string | null; appealNote: string | null; history: Array<{ action: string; actorName: string | null; note: string | null; createdAt: string }> })
  | (Base & { kind: "REPORT"; post: PostView; targetKind: string; commentBody: string | null; reason: string; details: string | null; reporterName: string | null; reportCount: number })
  | (Base & { kind: "LOOP"; text: string; asked: number; variants: string[]; roleCounts: Record<string, number>; reason: string; attempted: string | null; category: string | null; priority: string });

export interface QueueResult {
  items: QueueItem[];
  counts: Record<QueueFilter, number>;
}

const MAX_LOOP = 40;
const MAX_POSTS = 60;

export async function buildQueue(filter: QueueFilter): Promise<QueueResult> {
  const [posts, appeals, loopRows, reports] = await Promise.all([
    prisma.post.findMany({ where: { status: "PENDING_REVIEW" }, orderBy: { submittedAt: "asc" }, take: MAX_POSTS, include: { media: true } }),
    prisma.post.findMany({ where: { appealedAt: { not: null }, orgBlockedAt: { not: null } }, orderBy: { appealedAt: "asc" }, take: MAX_POSTS, include: { media: true } }),
    prisma.guideUnanswered.findMany({ where: { status: { in: ["OPEN", "IN_REVIEW"] } }, take: 300 }),
    prisma.postReport.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: MAX_POSTS }),
  ]);
  const loopSorted = sortQueue(loopRows.map(toQueueRow));
  const loopById = new Map(loopRows.map((r) => [r.id, r]));

  const reportedPosts = await prisma.post.findMany({ where: { id: { in: [...new Set(reports.map((r) => r.postId))] } }, include: { media: true } });
  const reporters = await prisma.profile.findMany({ where: { id: { in: reports.map((r) => r.reporterProfileId) } } });
  const reporterCards = await cardsFor(reporters);
  const comments = await prisma.postComment.findMany({ where: { id: { in: reports.map((r) => r.commentId).filter((x): x is string => !!x) } }, select: { id: true, body: true } });
  const ids = [...new Set([...posts, ...appeals].map((p) => p.id))];
  const history = await prisma.postReview.findMany({ where: { postId: { in: ids } }, orderBy: { createdAt: "asc" }, select: { postId: true, action: true, actorName: true, note: true, createdAt: true } });
  const histOf = (id: string) => history.filter((h) => h.postId === id).map((h) => ({ action: h.action, actorName: h.actorName, note: h.note, createdAt: h.createdAt.toISOString() }));
  const views = new Map((await postViews([...posts, ...appeals, ...reportedPosts])).map((v) => [v.id, v]));

  const escalators = [...posts, ...appeals].map((p) => p.escalatedById).concat(loopRows.map((r) => r.escalatedById), reports.map((r) => r.escalatedById)).filter((x): x is string => !!x);
  const users = escalators.length ? await prisma.user.findMany({ where: { id: { in: escalators } }, select: { id: true, name: true } }) : [];
  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;

  const all: Array<QueueItem & { _w: Date }> = [];
  for (const p of posts) all.push({ kind: "POST", id: p.id, _w: p.submittedAt ?? p.createdAt, waitingSince: (p.submittedAt ?? p.createdAt).toISOString(), escalated: !!p.escalatedAt, escalationNote: p.escalationNote, escalatedByName: nameOf(p.escalatedById), post: views.get(p.id)!, history: histOf(p.id) });
  for (const p of appeals) all.push({ kind: "APPEAL", id: p.id, _w: p.appealedAt!, waitingSince: p.appealedAt!.toISOString(), escalated: !!p.escalatedAt, escalationNote: p.escalationNote, escalatedByName: nameOf(p.escalatedById), post: views.get(p.id)!, orgBlockReason: p.orgBlockReason, appealNote: p.appealNote, history: histOf(p.id) });
  for (const r of reports) {
    const v = views.get(r.postId);
    if (!v) continue;
    all.push({ kind: "REPORT", id: r.id, _w: r.createdAt, waitingSince: r.createdAt.toISOString(), escalated: !!r.escalatedAt, escalationNote: r.escalationNote, escalatedByName: nameOf(r.escalatedById), post: v, targetKind: r.targetKind, commentBody: comments.find((c) => c.id === r.commentId)?.body ?? null, reason: REPORT_LABEL[r.reason as ReportReason] ?? r.reason, details: r.details, reporterName: reporterCards.get(r.reporterProfileId)?.name ?? null, reportCount: reports.filter((x) => x.postId === r.postId && x.commentId === r.commentId).length });
  }
  for (const q of loopSorted.slice(0, MAX_LOOP)) {
    const r = loopById.get(q.id)!;
    all.push({ kind: "LOOP", id: q.id, _w: r.firstAskedAt, waitingSince: r.firstAskedAt.toISOString(), escalated: !!r.escalatedAt, escalationNote: r.escalationNote, escalatedByName: nameOf(r.escalatedById), text: r.text, asked: r.asked, variants: r.variants.slice(0, 5), roleCounts: r.roleCounts as Record<string, number>, reason: r.reason, attempted: r.attempted, category: r.category, priority: q.priority });
  }
  const entries = all.map((i) => ({ ...i, waitingSince: i._w }));
  const counts = { all: 0, posts: 0, loop: 0, appeals: 0, reports: 0, escalated: 0 } as Record<QueueFilter, number>;
  for (const f of Object.keys(counts) as QueueFilter[]) counts[f] = entries.filter((e) => matchesFilter(e as never, f)).length;
  const ordered = orderQueue(entries).filter((e) => matchesFilter(e as never, filter));
  return { items: ordered.map(({ _w, ...rest }) => ({ ...rest, waitingSince: _w.toISOString() }) as unknown as QueueItem), counts };
}
