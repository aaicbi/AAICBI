import type { Profile, ProfileKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { appUrl } from "@/lib/appUrl";
import { notifyByEmail } from "@/lib/notifications/log";
import { handleChangeDecidedEmail, handleChangeRequestedEmail } from "@/lib/notifications/templates";
import { checkDecision, checkRequestInput, isOpen } from "@/lib/profiles/handleChangeCore";
import { ensureProfile, handleIsFree, profileHref } from "@/lib/profiles/profiles";

/**
 * Changing a handle: a person asks with a reason, a super admin decides. When a
 * change is made the old handle is kept in `ProfileHandleHistory` for good:
 * nobody else can take it, the old address forwards to the new one, and search
 * still finds the person by it. A member's or staff member's `username` column
 * is moved along with the handle so the two never differ.
 */
export class HandleChangeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** The profile a signed-in person speaks for, created on first use. */
export async function profileForSession(s: SessionPayload): Promise<Profile | null> {
  switch (s.role) {
    case "TRAINEE": return ensureProfile("PERSON", s.userId);
    case "EMPLOYER": return ensureProfile("EMPLOYER", s.userId);
    case "INVESTOR": return ensureProfile("INVESTOR", s.userId);
    case "SUPER_ADMIN": case "ADMIN": case "INSTRUCTOR": {
      // A training organization's own login speaks as the organization, not as a person.
      const org = s.role === "ADMIN" ? await prisma.trainingOrganization.findFirst({ where: { staffUserId: s.userId }, select: { id: true } }) : null;
      return org ? ensureProfile("TRAINING_ORG", org.id) : ensureProfile("STAFF", s.userId);
    }
    default: return null;
  }
}

export async function recipientOf(p: Profile): Promise<{ recipientType: "TRAINEE" | "STAFF" | "EMPLOYER" | "INVESTOR" | "TRAINING_ORG"; recipientId: string; to: string; name: string } | null> {
  if (p.kind === "PERSON" && p.traineeId) { const t = await prisma.trainee.findUnique({ where: { id: p.traineeId }, select: { name: true, email: true } }); return t && { recipientType: "TRAINEE", recipientId: p.traineeId, to: t.email, name: t.name }; }
  if (p.kind === "EMPLOYER" && p.employerId) { const e = await prisma.employer.findUnique({ where: { id: p.employerId }, select: { companyName: true, email: true } }); return e && { recipientType: "EMPLOYER", recipientId: p.employerId, to: e.email, name: e.companyName }; }
  if (p.kind === "INVESTOR" && p.investorId) { const i = await prisma.investor.findUnique({ where: { id: p.investorId }, select: { name: true, email: true } }); return i && { recipientType: "INVESTOR", recipientId: p.investorId, to: i.email, name: i.name }; }
  if (p.kind === "STAFF" && p.userId) { const u = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true } }); return u && { recipientType: "STAFF", recipientId: p.userId, to: u.email, name: u.name }; }
  if (p.kind === "STARTUP" && p.startupId) {
    const founder = await prisma.startupMember.findFirst({ where: { startupId: p.startupId, role: "FOUNDER", status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    const t = founder ? await prisma.trainee.findUnique({ where: { id: founder.traineeId }, select: { name: true, email: true } }) : null;
    const st = await prisma.startup.findUnique({ where: { id: p.startupId }, select: { name: true } });
    return t && founder && { recipientType: "TRAINEE", recipientId: founder.traineeId, to: t.email, name: st?.name ?? t.name };
  }
  if (p.kind === "TRAINING_ORG" && p.trainingOrganizationId) { const o = await prisma.trainingOrganization.findUnique({ where: { id: p.trainingOrganizationId }, select: { name: true, email: true } }); return o && { recipientType: "TRAINING_ORG", recipientId: p.trainingOrganizationId, to: o.email, name: o.name }; }
  return null;
}

/** Looks a handle up: the person who holds it now, or who held it before (`former` is then true). */
export async function resolveHandle(handle: string): Promise<{ profile: Profile; former: boolean } | null> {
  const now = await prisma.profile.findUnique({ where: { handle } });
  if (now) return { profile: now, former: false };
  const old = await prisma.profileHandleHistory.findUnique({ where: { handle } });
  if (!old) return null;
  const profile = await prisma.profile.findUnique({ where: { id: old.profileId } });
  return profile ? { profile, former: true } : null;
}

/** Makes `newHandle` the profile's handle, keeps the old one in history, and moves the username with it. */
async function applyChange(profile: Profile, newHandle: string, by: { id: string | null }, reason: string | null): Promise<void> {
  if (!(await handleIsFree(newHandle, profile.id))) throw new HandleChangeError("That handle is no longer available.", 409);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.profileHandleHistory.upsert({ where: { handle: profile.handle }, create: { profileId: profile.id, handle: profile.handle, changedById: by.id, reason }, update: {} });
      // Taking back an old handle of their own: it is no longer "former".
      await tx.profileHandleHistory.deleteMany({ where: { handle: newHandle, profileId: profile.id } });
      await tx.profile.update({ where: { id: profile.id }, data: { handle: newHandle } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HandleChangeError("That handle is no longer available.", 409);
    throw e;
  }
  // Keep the older username column in step, so /profile/u/<username> and the profile settings agree.
  try {
    if (profile.kind === "PERSON" && profile.traineeId) await prisma.trainee.update({ where: { id: profile.traineeId }, data: { username: newHandle } });
    if (profile.kind === "STAFF" && profile.userId) await prisma.user.update({ where: { id: profile.userId }, data: { username: newHandle } });
  } catch (e) {
    // Someone else already has that exact username text: the handle still changed.
    if (!isUniqueViolation(e)) throw e;
  }
}

async function notifySuperAdmins(profile: Profile, requestId: string, requested: string, reason: string, name: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", active: true, trainingOrgAsStaffUser: null }, select: { id: true, email: true } });
    const content = handleChangeRequestedEmail({ name, currentHandle: profile.handle, requestedHandle: requested, reason, reviewUrl: appUrl("/admin/handle-requests") });
    for (const a of admins) await notifyByEmail({ recipientType: "STAFF", recipientId: a.id, to: a.email, type: "HANDLE_CHANGE_REQUESTED", relatedId: requestId, url: "/admin/handle-requests", ...content });
  } catch (e) {
    console.error("Could not notify super admins of a handle request:", e instanceof Error ? e.message : e);
  }
}

export async function requestHandleChange(profile: Profile, input: { handle: unknown; reason: unknown }) {
  const check = checkRequestInput(input, profile.handle);
  if (!check.ok) throw new HandleChangeError(check.error);
  if (!(await handleIsFree(check.handle, profile.id))) throw new HandleChangeError("That handle is already taken or reserved.", 409);
  const pending = await prisma.handleChangeRequest.findFirst({ where: { profileId: profile.id, status: "PENDING" } });
  if (pending) throw new HandleChangeError("You already have a request waiting for a decision. Cancel it first to send a new one.", 409);
  // At most 5 requests a day per person (counted from real requests, so mistakes in the form do not use them up).
  const recent = await prisma.handleChangeRequest.count({ where: { profileId: profile.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  if (recent >= 5) throw new HandleChangeError("You have asked too many times today. Try again tomorrow.", 429);
  const row = await prisma.handleChangeRequest.create({ data: { profileId: profile.id, currentHandle: profile.handle, requestedHandle: check.handle, reason: check.reason } });
  const who = await recipientOf(profile);
  await notifySuperAdmins(profile, row.id, check.handle, check.reason, who?.name ?? profile.handle);
  return row;
}

export async function cancelHandleRequest(profile: Profile, requestId: string) {
  const res = await prisma.handleChangeRequest.updateMany({ where: { id: requestId, profileId: profile.id, status: "PENDING" }, data: { status: "CANCELLED", decidedAt: new Date() } });
  if (res.count === 0) throw new HandleChangeError("There is no waiting request to cancel.", 404);
}

export async function myHandleState(profile: Profile) {
  const requests = await prisma.handleChangeRequest.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return { handle: profile.handle, requests };
}

/** A super admin approves or declines. Approving changes the handle at once. */
export async function decideHandleRequest(requestId: string, action: "approve" | "reject", note: unknown, actor: { userId: string; name: string }) {
  const d = checkDecision(action, note);
  if (!d.ok) throw new HandleChangeError(d.error);
  const req = await prisma.handleChangeRequest.findUnique({ where: { id: requestId } });
  if (!req || !isOpen(req.status)) throw new HandleChangeError("That request was already dealt with.", 404);
  const profile = await prisma.profile.findUnique({ where: { id: req.profileId } });
  if (!profile) throw new HandleChangeError("That account no longer exists.", 404);

  if (action === "approve") await applyChange(profile, req.requestedHandle, { id: actor.userId }, req.reason);
  const claimed = await prisma.handleChangeRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: action === "approve" ? "APPROVED" : "REJECTED", decidedById: actor.userId, decidedByName: actor.name, decisionNote: d.note, decidedAt: new Date() },
  });
  if (claimed.count === 0) throw new HandleChangeError("That request was already dealt with.", 409);

  const who = await recipientOf(profile);
  if (who) {
    const handleNow = action === "approve" ? req.requestedHandle : profile.handle;
    const content = handleChangeDecidedEmail({ name: who.name, approved: action === "approve", requestedHandle: req.requestedHandle, note: d.note, profileUrl: appUrl(profileHref(handleNow)) });
    await notifyByEmail({ recipientType: who.recipientType, recipientId: who.recipientId, to: who.to, type: "HANDLE_CHANGE_DECIDED", relatedId: requestId, url: profileHref(handleNow), ...content });
  }
}

/** A super admin changes a handle directly (for organizations, which cannot ask, and for their own). Same history and reservation rules. */
export async function directHandleChange(profileId: string, newHandle: unknown, reason: unknown, actor: { userId: string }) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) throw new HandleChangeError("Profile not found.", 404);
  const check = checkRequestInput({ handle: newHandle, reason }, profile.handle);
  if (!check.ok) throw new HandleChangeError(check.error);
  await applyChange(profile, check.handle, { id: actor.userId }, check.reason);
  return check.handle;
}

/** A founder of a startup may ask for a change of the startup's handle. */
export async function startupProfileForFounder(startupId: string, traineeId: string): Promise<Profile> {
  const m = await prisma.startupMember.findUnique({ where: { startupId_traineeId: { startupId, traineeId } } });
  if (!m || m.status !== "ACTIVE" || m.role !== "FOUNDER") throw new HandleChangeError("Only a founder can ask to change the startup's handle.", 403);
  const p = await ensureProfile("STARTUP", startupId);
  if (!p) throw new HandleChangeError("Startup not found.", 404);
  return p;
}

export const kindsThatCanAsk: ProfileKind[] = ["PERSON", "EMPLOYER", "INVESTOR", "STAFF"];
