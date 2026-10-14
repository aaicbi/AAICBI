import { prisma } from "@/lib/prisma";
import { buildBrief, canMove, cleanRequestInput, cleanUrl, LIMITS, type ChangeRequestStatus } from "@/lib/changeRequests/core";

export class ChangeRequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const SELECT = {
  id: true,
  title: true,
  details: true,
  page: true,
  status: true,
  decisionNote: true,
  issueUrl: true,
  prUrl: true,
  createdAt: true,
  decidedAt: true,
  author: { select: { id: true, name: true } },
} as const;

/** A Super Admin sees every request; anyone else sees only their own. */
export async function listRequests(session: { userId: string; role: string }) {
  const rows = await prisma.changeRequest.findMany({
    where: session.role === "SUPER_ADMIN" ? {} : { authorId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: SELECT,
  });
  return rows.map((r) => ({ ...r, author: r.author.name, authorId: r.author.id }));
}

export async function createRequest(authorId: string, raw: { title?: unknown; details?: unknown; page?: unknown }) {
  const cleaned = cleanRequestInput(raw);
  if (!cleaned.ok) throw new ChangeRequestError(cleaned.error);
  const open = await prisma.changeRequest.count({ where: { authorId, status: "PROPOSED" } });
  if (open >= 30) throw new ChangeRequestError("You have 30 requests waiting already. Wait for some to be decided.", 429);
  return prisma.changeRequest.create({ data: { authorId, ...cleaned.value }, select: { id: true, title: true, status: true } });
}

/**
 * Opens a GitHub issue for an approved request, only when the platform has been given a repository and a token to do
 * it with. The token is read from the environment and never returned or logged. Returns the issue link, or null.
 */
async function openIssue(r: { id: string; title: string; details: string; page: string | null }): Promise<string | null> {
  const repo = process.env.CHANGE_REQUEST_GITHUB_REPO;
  const token = process.env.CHANGE_REQUEST_GITHUB_TOKEN;
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "aaicbi-change-requests" },
      body: JSON.stringify({
        title: `[Change request] ${r.title}`,
        body: `${r.details}\n\n${r.page ? `Where: ${r.page}\n` : ""}Request id: ${r.id}\n\nApproved by a Super Admin in the platform.`,
        labels: ["super-admin-approved"],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { html_url?: unknown } | null;
    return cleanUrl(json?.html_url);
  } catch {
    return null;
  }
}

/** Super Admin decisions: approve, decline, mark done, or reopen a declined one. */
export async function decideRequest(id: string, deciderId: string, input: { status: ChangeRequestStatus; note?: unknown; prUrl?: unknown }) {
  const row = await prisma.changeRequest.findUnique({ where: { id }, select: { id: true, title: true, details: true, page: true, status: true, issueUrl: true } });
  if (!row) throw new ChangeRequestError("That request could not be found.", 404);
  if (!canMove(row.status, input.status)) throw new ChangeRequestError(`A request that is "${row.status.toLowerCase()}" can't be moved to "${input.status.toLowerCase()}".`, 409);
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, LIMITS.note) : null;
  const data: { status: ChangeRequestStatus; decidedById: string; decidedAt: Date; decisionNote?: string | null; issueUrl?: string; prUrl?: string | null } = {
    status: input.status,
    decidedById: deciderId,
    decidedAt: new Date(),
  };
  if (note !== null || input.status !== "PROPOSED") data.decisionNote = note;
  if (input.status === "DONE") data.prUrl = cleanUrl(input.prUrl);
  if (input.status === "APPROVED" && !row.issueUrl) {
    const url = await openIssue(row);
    if (url) data.issueUrl = url;
  }
  await prisma.changeRequest.update({ where: { id }, data });
  return { ok: true as const, issueUrl: data.issueUrl ?? row.issueUrl ?? null };
}

/** The hand-off text for Claude Code: every approved request. */
export async function approvedBrief() {
  const rows = await prisma.changeRequest.findMany({
    where: { status: "APPROVED" },
    orderBy: { decidedAt: "asc" },
    select: { id: true, title: true, details: true, page: true, decisionNote: true, decidedAt: true, author: { select: { name: true } }, decidedById: true },
  });
  const deciderIds = Array.from(new Set(rows.map((r) => r.decidedById).filter((v): v is string => !!v)));
  const deciders = deciderIds.length ? await prisma.user.findMany({ where: { id: { in: deciderIds } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(deciders.map((d) => [d.id, d.name]));
  return {
    count: rows.length,
    markdown: buildBrief(rows.map((r) => ({ id: r.id, title: r.title, details: r.details, page: r.page, decisionNote: r.decisionNote, author: r.author.name, decidedBy: r.decidedById ? nameOf.get(r.decidedById) ?? null : null, decidedAt: r.decidedAt }))),
  };
}
