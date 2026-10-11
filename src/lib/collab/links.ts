import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { assignmentAccess, courseAccess, examAccess, type Access } from "@/lib/collab/access";
import { canCollaborate, DEFAULT_MAX_USES, hashToken, LINK_LIFETIME_MS, LINK_STATE_MESSAGE, linkState, newToken, RESOURCE_LABEL, type LinkRole, type ResourceType } from "@/lib/collab/core";

export class CollabError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

interface Resource {
  type: ResourceType;
  id: string;
  title: string;
  ownerId: string;
}

async function loadResource(type: ResourceType, id: string): Promise<{ res: Resource; access: (userId: string, role?: string) => Promise<Access> } | null> {
  if (type === "COURSE") {
    const c = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true, createdById: true } });
    return c ? { res: { type, id, title: c.title, ownerId: c.createdById }, access: (u, r) => courseAccess(c, u, r) } : null;
  }
  if (type === "EXAM") {
    const e = await prisma.exam.findUnique({ where: { id }, select: { id: true, title: true, createdById: true, courseId: true, moduleId: true } });
    return e ? { res: { type, id, title: e.title, ownerId: e.createdById }, access: (u) => examAccess(e, u) } : null;
  }
  const a = await prisma.assignment.findUnique({ where: { id }, select: { id: true, title: true, createdById: true, courseId: true, moduleId: true } });
  return a ? { res: { type, id, title: a.title, ownerId: a.createdById }, access: (u, r) => assignmentAccess(a, u, r) } : null;
}

/** The name people see for a staff account: the organization's name for an organization's account, else the person's name. */
export async function displayNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return new Map();
  const [orgs, users] = await Promise.all([
    prisma.trainingOrganization.findMany({ where: { staffUserId: { in: ids } }, select: { staffUserId: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } }),
  ]);
  const out = new Map<string, string>();
  for (const u of users) out.set(u.id, u.role === "INSTRUCTOR" ? `${u.name} (instructor)` : u.name);
  for (const o of orgs) out.set(o.staffUserId as string, `${o.name} (organization)`);
  return out;
}

async function requireAccess(type: ResourceType, id: string, session: { userId: string; role: string }) {
  const found = await loadResource(type, id);
  if (!found) throw new CollabError("Not found.", 404);
  const access = await found.access(session.userId, session.role);
  if (!access) throw new CollabError("Not found.", 404);
  return { ...found, access };
}

async function shareName(session: { userId: string; role: string }): Promise<string> {
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (org) return org.name;
  return (await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? "A colleague";
}

/** Makes a link. Anyone who can edit may invite another editor; only an owner may hand out copies. The link is returned once. */
export async function createLink(session: { userId: string; role: string }, input: { type: ResourceType; id: string; role: LinkRole }) {
  const { res, access } = await requireAccess(input.type, input.id, session);
  if (input.role === "COPY" && (input.type !== "COURSE" || access !== "owner")) throw new CollabError("Only the owner of a course can share a copy of it.", 403);
  const token = newToken();
  const link = await prisma.contentShareLink.create({
    data: { resourceType: input.type, resourceId: input.id, tokenHash: hashToken(token), role: input.role, createdById: session.userId, createdByName: await shareName(session), expiresAt: new Date(Date.now() + LINK_LIFETIME_MS), maxUses: DEFAULT_MAX_USES },
  });
  return { id: link.id, url: appUrl(`/collaborate/${token}`), expiresAt: link.expiresAt, role: link.role, title: res.title };
}

export async function listSharing(session: { userId: string; role: string }, type: ResourceType, id: string) {
  const { res, access } = await requireAccess(type, id, session);
  const [links, collaborators] = await Promise.all([
    prisma.contentShareLink.findMany({ where: { resourceType: type, resourceId: id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.contentCollaborator.findMany({ where: { resourceType: type, resourceId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  const names = await displayNames([res.ownerId, ...collaborators.map((c) => c.userId)]);
  return {
    title: res.title,
    youAre: access,
    owner: names.get(res.ownerId) ?? "Owner",
    links: links.filter((l) => linkState(l) === "ok").map((l) => ({ id: l.id, role: l.role, createdByName: l.createdByName, expiresAt: l.expiresAt, uses: l.useCount, maxUses: l.maxUses, mine: l.createdById === session.userId })),
    collaborators: collaborators.map((c) => ({ id: c.id, name: names.get(c.userId) ?? "Collaborator", role: c.role, since: c.createdAt, you: c.userId === session.userId })),
  };
}

export async function revokeLink(session: { userId: string; role: string }, linkId: string) {
  const link = await prisma.contentShareLink.findUnique({ where: { id: linkId } });
  if (!link) throw new CollabError("Not found.", 404);
  const { access } = await requireAccess(link.resourceType as ResourceType, link.resourceId, session);
  if (access !== "owner" && link.createdById !== session.userId) throw new CollabError("Only the owner, or whoever made the link, can cancel it.", 403);
  await prisma.contentShareLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } });
}

/** The owner can remove anyone; an editor can leave. */
export async function removeCollaborator(session: { userId: string; role: string }, collaboratorId: string) {
  const c = await prisma.contentCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!c) throw new CollabError("Not found.", 404);
  const { access } = await requireAccess(c.resourceType as ResourceType, c.resourceId, session);
  if (access !== "owner" && c.userId !== session.userId) throw new CollabError("Only the owner can remove someone.", 403);
  await prisma.contentCollaborator.delete({ where: { id: collaboratorId } });
}

/** What the accept page shows before anyone signs in: what is shared, by whom, and whether the link still works. */
export async function previewLink(token: string) {
  const link = await prisma.contentShareLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link) return null;
  const found = await loadResource(link.resourceType as ResourceType, link.resourceId);
  const state = linkState(link);
  return {
    state,
    message: state === "ok" ? null : LINK_STATE_MESSAGE[state],
    kind: link.resourceType as ResourceType,
    kindLabel: RESOURCE_LABEL[link.resourceType as ResourceType],
    role: link.role as LinkRole,
    title: found?.res.title ?? null,
    sharedBy: link.createdByName,
  };
}

export type AcceptResult = { kind: "joined"; type: ResourceType; id: string; title: string; href: string } | { kind: "already"; type: ResourceType; id: string; title: string; href: string };

export function editHref(type: ResourceType, id: string): string {
  return type === "COURSE" ? `/admin/courses/${id}` : type === "EXAM" ? `/admin/exams/${id}/import` : `/admin/assignments/${id}`;
}

/** Joins the signed-in staff member, instructor or organization to what the link shares (editor links). */
export async function acceptEditorLink(session: { userId: string; role: string }, token: string): Promise<AcceptResult> {
  if (!canCollaborate(session.role)) throw new CollabError("Only staff, instructors and training organizations can join.", 403);
  const link = await prisma.contentShareLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link) throw new CollabError("This link is not valid.", 404);
  const state = linkState(link);
  if (state !== "ok") throw new CollabError(LINK_STATE_MESSAGE[state], 410);
  if (link.role !== "EDITOR") throw new CollabError("This link is for taking a copy, not for editing together.", 400);
  const type = link.resourceType as ResourceType;
  const found = await loadResource(type, link.resourceId);
  if (!found) throw new CollabError("What was shared no longer exists.", 404);
  const title = found.res.title;
  const href = editHref(type, link.resourceId);
  if ((await found.access(session.userId, session.role)) !== null) return { kind: "already", type, id: link.resourceId, title, href };
  const claimed = await prisma.contentShareLink.updateMany({ where: { id: link.id, revokedAt: null, useCount: { lt: link.maxUses }, expiresAt: { gt: new Date() } }, data: { useCount: { increment: 1 } } });
  if (claimed.count === 0) throw new CollabError(LINK_STATE_MESSAGE.used_up, 410);
  await prisma.contentCollaborator.upsert({
    where: { resourceType_resourceId_userId: { resourceType: type, resourceId: link.resourceId, userId: session.userId } },
    create: { resourceType: type, resourceId: link.resourceId, userId: session.userId, role: "EDITOR", invitedById: link.createdById },
    update: {},
  });
  return { kind: "joined", type, id: link.resourceId, title, href };
}
