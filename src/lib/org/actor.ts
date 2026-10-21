import { instructorWriteVerdict } from "./memberCourses";
import { prisma } from "@/lib/prisma";
import type { TrainingOrganization } from "@prisma/client";
import { describeAction, isMemberRole, mayDo, worthLogging, type OrgRole } from "@/lib/org/people";

/**
 * The person behind an organization's session. An organization's content is owned by its one internal staff account, so the
 * session's `userId` is the organization; the person is told apart by the email they signed in with (the owner's own, or
 * a teammate's). Their role comes from the database on every request, so removing or demoting someone takes effect at once
 * and not when their session ends.
 */
export interface OrgActor {
  type: "OWNER" | "MEMBER";
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  organizationId: string;
  organizationName: string;
}

export class ActorError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function resolveOrgActor(org: Pick<TrainingOrganization, "id" | "name" | "email" | "contactName">, sessionEmail: string): Promise<OrgActor> {
  const email = sessionEmail.toLowerCase();
  if (org.email.toLowerCase() === email) return { type: "OWNER", id: org.id, name: org.contactName, email, role: "OWNER", organizationId: org.id, organizationName: org.name };
  const m = await prisma.trainingOrganizationMember.findFirst({ where: { trainingOrganizationId: org.id, email: { equals: email, mode: "insensitive" } }, select: { id: true, name: true, role: true, disabledAt: true } });
  if (!m || m.disabledAt) throw new ActorError("Your access to this organization has ended.", 401);
  return { type: "MEMBER", id: m.id, name: m.name, email, role: isMemberRole(m.role) ? m.role : "EDITOR", organizationId: org.id, organizationName: org.name };
}

/** Called for every organization request: refuses what the person's role does not allow, and records what changes. */
export async function enforceAndRecord(actor: OrgActor, orgUserId: string, request: { method: string | null; path: string | null }): Promise<void> {
  const { method, path } = request;
  if (!method || !path || !path.startsWith("/api/")) return;
  const verdict = mayDo(actor.role, method, path);
  if (!verdict.ok) throw new ActorError(verdict.reason, 403);
  if (actor.role === "INSTRUCTOR") {
    const refusal = await instructorWriteVerdict(actor.id, method, path);
    if (refusal) throw new ActorError(refusal, 403);
  }
  if (!worthLogging(method, path)) return;
  try {
    await prisma.orgActivity.create({ data: { orgUserId, actorType: actor.type, actorId: actor.id, actorName: actor.name, action: describeAction(method, path), method: method.toUpperCase(), path: path.slice(0, 200) } });
  } catch (e) {
    console.error("Could not record organization activity:", e instanceof Error ? e.message : e);
  }
}

/**
 * False when a session belongs to a person who has been disabled or removed from a training organization. Real staff
 * accounts and the organization's owner are always fine. Checked whenever a session is read, so it ends at once and not when
 * the cookie would have expired.
 */
export async function orgPersonStillValid(userId: string, email: string): Promise<boolean> {
  const org = await prisma.trainingOrganization.findFirst({ where: { staffUserId: userId }, select: { id: true, email: true } });
  if (!org) return true;
  if (org.email.toLowerCase() === email.toLowerCase()) return true;
  const m = await prisma.trainingOrganizationMember.findFirst({ where: { trainingOrganizationId: org.id, email: { equals: email, mode: "insensitive" } }, select: { disabledAt: true } });
  return !!m && !m.disabledAt;
}
