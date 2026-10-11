import type { Prisma, Startup, StartupMember } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { notifyByEmail } from "@/lib/notifications/log";
import { simpleNoticeEmail } from "@/lib/notifications/templates";
import { ensureProfile, profileHref } from "@/lib/profiles/profiles";
import { AdminAction, StartupInput, can, canSubmit, missingForSubmit, nextStatus, wouldLeaveNoFounder } from "@/lib/startups/startupCore";

/**
 * Startups with a team. Members are existing member (trainee) accounts, added
 * only with their own acceptance. A startup is public only once a super admin
 * approves it; "verified" is a separate mark that only a person sets.
 */
export class StartupError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const MAX_STARTUPS_PER_PERSON = 5;
const MAX_TEAM = 20;

export async function membershipOf(startupId: string, traineeId: string): Promise<StartupMember | null> {
  return prisma.startupMember.findUnique({ where: { startupId_traineeId: { startupId, traineeId } } });
}

async function requireMember(startupId: string, traineeId: string, action: Parameters<typeof can>[1]): Promise<StartupMember> {
  const m = await membershipOf(startupId, traineeId);
  if (!m || m.status !== "ACTIVE") throw new StartupError("You are not on this startup's team.", 403);
  if (!can(m, action)) throw new StartupError("You do not have permission to do that for this startup.", 403);
  return m;
}

export async function createStartup(traineeId: string, input: StartupInput): Promise<Startup> {
  const owned = await prisma.startupMember.count({ where: { traineeId, role: "FOUNDER", status: "ACTIVE" } });
  if (owned >= MAX_STARTUPS_PER_PERSON) throw new StartupError(`You can found up to ${MAX_STARTUPS_PER_PERSON} startups.`, 409);
  const startup = await prisma.startup.create({
    data: { ...input, createdById: traineeId, members: { create: { traineeId, role: "FOUNDER", canEdit: true, canPublish: true, status: "ACTIVE", joinedAt: new Date() } } },
  });
  await ensureProfile("STARTUP", startup.id);
  return startup;
}

export async function updateStartup(startupId: string, traineeId: string, input: StartupInput): Promise<Startup> {
  await requireMember(startupId, traineeId, "edit");
  return prisma.startup.update({ where: { id: startupId }, data: input });
}

export async function setLogo(startupId: string, traineeId: string, url: string | null): Promise<string | null> {
  await requireMember(startupId, traineeId, "edit");
  const before = await prisma.startup.findUnique({ where: { id: startupId }, select: { logoUrl: true } });
  await prisma.startup.update({ where: { id: startupId }, data: { logoUrl: url } });
  return before?.logoUrl ?? null;
}

async function notifyTrainee(traineeId: string, type: "STARTUP_SUBMITTED" | "STARTUP_DECIDED" | "STARTUP_INVITE", relatedId: string, content: ReturnType<typeof simpleNoticeEmail>, url: string) {
  try {
    const t = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { email: true } });
    if (t) await notifyByEmail({ recipientType: "TRAINEE", recipientId: traineeId, to: t.email, type, relatedId, url, ...content });
  } catch (e) {
    console.error("Startup notification failed:", e instanceof Error ? e.message : e);
  }
}

export async function submitStartup(startupId: string, traineeId: string): Promise<void> {
  await requireMember(startupId, traineeId, "submit");
  const s = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!s) throw new StartupError("Startup not found.", 404);
  if (!canSubmit(s.status)) throw new StartupError("This startup is already with a reviewer or has been decided.", 409);
  const missing = missingForSubmit(s);
  if (missing.length) throw new StartupError(`Before sending for review, add ${missing.join(", ")}.`);
  await prisma.startup.update({ where: { id: startupId }, data: { status: "PENDING", submittedAt: new Date(), reviewNote: null } });
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", active: true, trainingOrgAsStaffUser: null }, select: { id: true, email: true } });
    const content = simpleNoticeEmail({ subject: `Startup awaiting review: ${s.name}`, paragraphs: [`${s.name} was sent for review and is waiting for a decision.`], buttonLabel: "Review startups", url: appUrl("/admin/startups") });
    for (const a of admins) await notifyByEmail({ recipientType: "STAFF", recipientId: a.id, to: a.email, type: "STARTUP_SUBMITTED", relatedId: startupId, url: "/admin/startups", ...content });
  } catch (e) {
    console.error("Could not notify super admins of a startup:", e instanceof Error ? e.message : e);
  }
}

export async function decideStartup(startupId: string, action: AdminAction, note: string | null, actor: { userId: string }): Promise<void> {
  const s = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!s) throw new StartupError("Startup not found.", 404);
  const next = nextStatus(s.status, action, note);
  // A missing reason is a problem with the request (400); a wrong starting status is a conflict (409).
  if (!next.ok) throw new StartupError(next.error, /reason/i.test(next.error) ? 400 : 409);
  const res = await prisma.startup.updateMany({
    where: { id: startupId, status: s.status },
    data: { status: next.status as Startup["status"], reviewNote: note?.trim() || null, reviewedById: actor.userId, reviewedAt: new Date() },
  });
  if (res.count === 0) throw new StartupError("Someone else just decided this startup.", 409);
  const profile = await ensureProfile("STARTUP", startupId);
  const founders = await prisma.startupMember.findMany({ where: { startupId, role: "FOUNDER", status: "ACTIVE" }, select: { traineeId: true } });
  const words: Record<AdminAction, string> = { approve: "was approved and is now public", reject: "was not approved", suspend: "was suspended", reinstate: "is public again" };
  const url = profile ? profileHref(profile.handle) : "/trainee/startups";
  const content = simpleNoticeEmail({ subject: `${s.name} ${words[action]}`, paragraphs: [`${s.name} ${words[action]}.`, ...(note ? [`Reviewer's note: ${note}`] : [])], buttonLabel: "Open your startup", url: appUrl(action === "approve" || action === "reinstate" ? url : `/trainee/startups/${startupId}`) });
  for (const f of founders) await notifyTrainee(f.traineeId, "STARTUP_DECIDED", startupId, content, action === "approve" || action === "reinstate" ? url : `/trainee/startups/${startupId}`);
}

export async function setVerified(startupId: string, verified: boolean): Promise<void> {
  const s = await prisma.startup.findUnique({ where: { id: startupId }, select: { status: true } });
  if (!s) throw new StartupError("Startup not found.", 404);
  if (verified && s.status !== "APPROVED") throw new StartupError("Only an approved startup can be marked verified.", 409);
  await prisma.startup.update({ where: { id: startupId }, data: { verified } });
}

// ---- Team ----

export async function teamOf(startupId: string, traineeId: string) {
  await requireMember(startupId, traineeId, "view_private");
  const members = await prisma.startupMember.findMany({ where: { startupId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const people = await prisma.trainee.findMany({ where: { id: { in: members.map((m) => m.traineeId) } }, select: { id: true, name: true } });
  const profiles = await prisma.profile.findMany({ where: { traineeId: { in: members.map((m) => m.traineeId) } }, select: { traineeId: true, handle: true } });
  const name = new Map(people.map((p) => [p.id, p.name]));
  const handle = new Map(profiles.map((p) => [p.traineeId, p.handle]));
  return members.map((m) => ({ ...m, name: name.get(m.traineeId) ?? "Member", handle: handle.get(m.traineeId) ?? null }));
}

export async function inviteMember(startupId: string, actorTraineeId: string, rawHandle: string, opts: { title?: string | null; canEdit?: boolean; canPublish?: boolean }) {
  await requireMember(startupId, actorTraineeId, "manage_team");
  const handle = rawHandle.trim().replace(/^@+/, "").toLowerCase();
  const target = await prisma.profile.findUnique({ where: { handle } });
  if (!target || target.kind !== "PERSON" || !target.traineeId) throw new StartupError("No member has that handle. Team members must have a member account.", 404);
  if (target.traineeId === actorTraineeId) throw new StartupError("You are already on the team.", 409);
  const count = await prisma.startupMember.count({ where: { startupId } });
  if (count >= MAX_TEAM) throw new StartupError(`A team can have up to ${MAX_TEAM} people.`, 409);
  const exists = await membershipOf(startupId, target.traineeId);
  if (exists) throw new StartupError(exists.status === "ACTIVE" ? "That person is already on the team." : "That person already has an invitation.", 409);
  const s = await prisma.startup.findUnique({ where: { id: startupId }, select: { name: true } });
  const row = await prisma.startupMember.create({
    data: { startupId, traineeId: target.traineeId, role: "MEMBER", canEdit: !!opts.canEdit, canPublish: !!opts.canPublish, title: opts.title?.trim().slice(0, 60) || null, invitedById: actorTraineeId, status: "INVITED" },
  });
  const content = simpleNoticeEmail({ subject: `You were invited to join ${s?.name ?? "a startup"}`, paragraphs: [`You were invited to join the team of ${s?.name ?? "a startup"} on AAICBI. You only join if you accept.`], buttonLabel: "See the invitation", url: appUrl("/trainee/startups") });
  await notifyTrainee(target.traineeId, "STARTUP_INVITE", row.id, content, "/trainee/startups");
  return row;
}

export async function respondToInvite(memberId: string, traineeId: string, accept: boolean) {
  const m = await prisma.startupMember.findUnique({ where: { id: memberId } });
  if (!m || m.traineeId !== traineeId || m.status !== "INVITED") throw new StartupError("That invitation is not available.", 404);
  if (accept) await prisma.startupMember.update({ where: { id: memberId }, data: { status: "ACTIVE", joinedAt: new Date() } });
  else await prisma.startupMember.delete({ where: { id: memberId } });
}

export async function updateMember(startupId: string, actorTraineeId: string, memberId: string, patch: { canEdit?: boolean; canPublish?: boolean; title?: string | null; role?: "FOUNDER" | "MEMBER"; showOnProfile?: boolean }) {
  const actor = await requireMember(startupId, actorTraineeId, "view_private");
  const target = await prisma.startupMember.findFirst({ where: { id: memberId, startupId } });
  if (!target) throw new StartupError("That team member was not found.", 404);
  const isSelf = target.traineeId === actorTraineeId;
  const data: Prisma.StartupMemberUpdateInput = {};
  // Anyone may choose whether they are shown on the public profile; only founders change the rest.
  if (patch.showOnProfile !== undefined) {
    if (!isSelf && !can(actor, "manage_team")) throw new StartupError("Only the person themselves, or a founder, can change that.", 403);
    data.showOnProfile = patch.showOnProfile;
  }
  const wantsManage = patch.canEdit !== undefined || patch.canPublish !== undefined || patch.title !== undefined || patch.role !== undefined;
  if (wantsManage) {
    if (!can(actor, "manage_team")) throw new StartupError("Only a founder can change what a team member may do.", 403);
    if (patch.canEdit !== undefined) data.canEdit = patch.canEdit;
    if (patch.canPublish !== undefined) data.canPublish = patch.canPublish;
    if (patch.title !== undefined) data.title = patch.title?.trim().slice(0, 60) || null;
    if (patch.role !== undefined) {
      if (patch.role === "MEMBER" && target.role === "FOUNDER") {
        const all = await prisma.startupMember.findMany({ where: { startupId }, select: { id: true, role: true, status: true } });
        if (wouldLeaveNoFounder(all, memberId)) throw new StartupError("A startup needs at least one founder.", 409);
      }
      data.role = patch.role;
    }
  }
  return prisma.startupMember.update({ where: { id: memberId }, data });
}

/** A founder removes someone, or a person leaves. The last founder cannot go. */
export async function removeMember(startupId: string, actorTraineeId: string, memberId: string) {
  const actor = await requireMember(startupId, actorTraineeId, "view_private");
  const target = await prisma.startupMember.findFirst({ where: { id: memberId, startupId } });
  if (!target) throw new StartupError("That team member was not found.", 404);
  const isSelf = target.traineeId === actorTraineeId;
  if (!isSelf && !can(actor, "manage_team")) throw new StartupError("Only a founder can remove someone from the team.", 403);
  const all = await prisma.startupMember.findMany({ where: { startupId }, select: { id: true, role: true, status: true } });
  if (target.role === "FOUNDER" && target.status === "ACTIVE" && wouldLeaveNoFounder(all, memberId)) throw new StartupError("A startup needs at least one founder. Make someone else a founder first.", 409);
  await prisma.startupMember.delete({ where: { id: memberId } });
}

export async function myStartups(traineeId: string) {
  const memberships = await prisma.startupMember.findMany({ where: { traineeId }, include: { startup: true }, orderBy: { createdAt: "desc" } });
  const profiles = await prisma.profile.findMany({ where: { startupId: { in: memberships.map((m) => m.startupId) } }, select: { startupId: true, handle: true } });
  const handle = new Map(profiles.map((p) => [p.startupId, p.handle]));
  return memberships.map((m) => ({ member: m, startup: m.startup, handle: handle.get(m.startupId) ?? null }));
}

/** The startup a profile page shows, with its visible team. Null unless the viewer may see it. */
export async function startupProfileData(startupId: string, viewer: { userId: string; role: string } | null) {
  const s = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!s) return null;
  const isStaff = !!viewer && ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(viewer.role);
  const mine = viewer?.role === "TRAINEE" ? await membershipOf(startupId, viewer.userId) : null;
  const onTeam = !!mine && mine.status === "ACTIVE";
  if (s.status !== "APPROVED" && !isStaff && !onTeam) return null;
  const members = await prisma.startupMember.findMany({ where: { startupId, status: "ACTIVE", showOnProfile: true }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const people = await prisma.trainee.findMany({ where: { id: { in: members.map((m) => m.traineeId) } }, select: { id: true, name: true, avatarUrl: true } });
  const profiles = await prisma.profile.findMany({ where: { traineeId: { in: members.map((m) => m.traineeId) } }, select: { traineeId: true, handle: true } });
  const person = new Map(people.map((p) => [p.id, p]));
  const handle = new Map(profiles.map((p) => [p.traineeId, p.handle]));
  return { startup: s, team: members.map((m) => ({ name: person.get(m.traineeId)?.name ?? "Member", handle: handle.get(m.traineeId) ?? null, role: m.role, title: m.title })) };
}

/** The public directory: approved startups, newest first, optionally narrowed by a word. */
export async function publicStartups(opts: { q?: string; industry?: string; take?: number } = {}) {
  const rows = await prisma.startup.findMany({
    where: {
      status: "APPROVED",
      ...(opts.industry ? { industry: opts.industry } : {}),
      ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { tagline: { contains: opts.q, mode: "insensitive" } }, { industry: { contains: opts.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 30,
  });
  const profiles = await prisma.profile.findMany({ where: { startupId: { in: rows.map((r) => r.id) } }, select: { startupId: true, handle: true } });
  const handle = new Map(profiles.map((p) => [p.startupId, p.handle]));
  return rows.map((r) => ({ ...r, handle: handle.get(r.id) ?? null }));
}
