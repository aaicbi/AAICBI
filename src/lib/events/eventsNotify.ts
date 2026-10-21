import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push/send";
import { staffPermissionsOf } from "@/lib/rbac/guard";
import type { Audience, TargetInput } from "@/lib/events/eventsCore";
import { noticeFor, type Notice, type NoticeEvent, type NoticeKind } from "@/lib/events/eventsNotices";

/**
 * Sends Event Manager notifications through the platform's own in-app notifications (and web push for small audiences). One row in
 * EventNotice per person and kind and event makes a retry or a second press harmless, so nobody is told twice. A failure here never
 * breaks the event action that caused it.
 */
export interface Recipient { recipientType: "TRAINEE" | "STAFF" | "EMPLOYER" | "INVESTOR" | "TRAINING_ORG"; recipientId: string }

const CHUNK = 500;
const PUSH_LIMIT = 200;
const key = (r: Recipient) => `${r.recipientType}:${r.recipientId}`;
const uniq = (list: Recipient[]) => [...new Map(list.map((r) => [key(r), r])).values()];

/** Trainees with access to any course of the organizations given (or of every organization when none is given). */
async function traineesOfOrgs(orgIds: string[] | null): Promise<string[]> {
  const orgs = await prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED", staffUserId: { not: null }, ...(orgIds ? { id: { in: orgIds } } : {}) }, select: { staffUserId: true } });
  const owners = orgs.map((o) => o.staffUserId).filter((x): x is string => !!x);
  if (!owners.length) return [];
  const rows = await prisma.courseEnrollment.findMany({ where: { accessRevokedAt: null, course: { createdById: { in: owners } } }, select: { traineeId: true }, distinct: ["traineeId"], take: 50_000 });
  return rows.map((r) => r.traineeId);
}

async function traineesOfTargets(targets: TargetInput[]): Promise<Recipient[]> {
  const ids = (k: string) => targets.filter((t) => t.kind === k).map((t) => t.refId);
  const [cohort, course, profiles] = await Promise.all([
    ids("COHORT").length ? prisma.enrollmentRecord.findMany({ where: { cohortId: { in: ids("COHORT") } }, select: { traineeId: true } }) : [],
    ids("COURSE").length ? prisma.courseEnrollment.findMany({ where: { courseId: { in: ids("COURSE") }, accessRevokedAt: null }, select: { traineeId: true } }) : [],
    ids("PROFILE").length ? prisma.profile.findMany({ where: { id: { in: ids("PROFILE") } }, select: { traineeId: true, employerId: true, investorId: true, trainingOrganizationId: true, userId: true } }) : [],
  ]);
  const out: Recipient[] = [
    ...cohort.map((r) => ({ recipientType: "TRAINEE" as const, recipientId: r.traineeId })),
    ...course.map((r) => ({ recipientType: "TRAINEE" as const, recipientId: r.traineeId })),
    ...ids("TRAINEE").map((id) => ({ recipientType: "TRAINEE" as const, recipientId: id })),
  ];
  for (const p of profiles) {
    if (p.traineeId) out.push({ recipientType: "TRAINEE", recipientId: p.traineeId });
    else if (p.employerId) out.push({ recipientType: "EMPLOYER", recipientId: p.employerId });
    else if (p.investorId) out.push({ recipientType: "INVESTOR", recipientId: p.investorId });
    else if (p.trainingOrganizationId) out.push({ recipientType: "TRAINING_ORG", recipientId: p.trainingOrganizationId });
    else if (p.userId) out.push({ recipientType: "STAFF", recipientId: p.userId });
  }
  return out;
}

export interface AudienceInput { trainingOrganizationId: string | null; audience: Audience; targets: TargetInput[] }

/** The people an event is meant for. Never includes the organisation that owns it. */
export async function audienceRecipients(e: AudienceInput): Promise<Recipient[]> {
  const owner = e.trainingOrganizationId;
  let list: Recipient[] = [];
  switch (e.audience) {
    case "PUBLIC": {
      const [trainees, employers, investors, orgs] = await Promise.all([
        prisma.trainee.findMany({ select: { id: true }, take: 50_000 }),
        prisma.employer.findMany({ where: { approvalState: "APPROVED" }, select: { id: true }, take: 20_000 }),
        prisma.investor.findMany({ where: { approvalState: "APPROVED" }, select: { id: true }, take: 20_000 }),
        prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, select: { id: true }, take: 20_000 }),
      ]);
      list = [
        ...trainees.map((r) => ({ recipientType: "TRAINEE" as const, recipientId: r.id })),
        ...employers.map((r) => ({ recipientType: "EMPLOYER" as const, recipientId: r.id })),
        ...investors.map((r) => ({ recipientType: "INVESTOR" as const, recipientId: r.id })),
        ...orgs.map((r) => ({ recipientType: "TRAINING_ORG" as const, recipientId: r.id })),
      ];
      break;
    }
    case "ORG_MEMBERS": {
      const t = await traineesOfOrgs(owner ? [owner] : null);
      list = t.map((id) => ({ recipientType: "TRAINEE" as const, recipientId: id }));
      if (!owner) list.push(...(await prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, select: { id: true } })).map((r) => ({ recipientType: "TRAINING_ORG" as const, recipientId: r.id })));
      break;
    }
    case "ORG_STAFF":
      if (!owner) list = (await prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, select: { id: true } })).map((r) => ({ recipientType: "TRAINING_ORG" as const, recipientId: r.id }));
      break;
    case "SELECTED_TRAINEES":
    case "INVITED":
    case "PRIVATE":
      list = await traineesOfTargets(e.targets);
      break;
  }
  return uniq(list).filter((r) => !(owner && r.recipientType === "TRAINING_ORG" && r.recipientId === owner));
}

/** AAICBI staff who review promotion requests: every Super Admin, and staff holding the permission. Organization accounts are never included. */
export async function promotionReviewers(): Promise<Recipient[]> {
  const users = await prisma.user.findMany({ where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"] }, trainingOrgAsStaffUser: null }, select: { id: true, role: true } });
  const out: Recipient[] = [];
  for (const u of users) {
    if (u.role === "SUPER_ADMIN" || (await staffPermissionsOf(u.id)).has("events.promotions:view")) out.push({ recipientType: "STAFF", recipientId: u.id });
  }
  return out;
}

/** Sends one kind of notice to the people who have not had it yet. Returns how many were told. Never throws. */
export async function sendNotice(eventId: string, kind: string, recipients: Recipient[], notice: Notice, opts: { dedupeKind?: string } = {}): Promise<number> {
  try {
    const list = uniq(recipients);
    if (!list.length) return 0;
    const dedupe = opts.dedupeKind ?? kind;
    let sent = 0;
    for (let i = 0; i < list.length; i += CHUNK) {
      const part = list.slice(i, i + CHUNK);
      const done = await prisma.eventNotice.findMany({ where: { eventId, kind: dedupe, OR: part.map((r) => ({ recipientType: r.recipientType, recipientId: r.recipientId })) }, select: { recipientType: true, recipientId: true } });
      const have = new Set(done.map((d) => `${d.recipientType}:${d.recipientId}`));
      const fresh = part.filter((r) => !have.has(key(r)));
      if (!fresh.length) continue;
      await prisma.eventNotice.createMany({ data: fresh.map((r) => ({ eventId, kind: dedupe, recipientType: r.recipientType, recipientId: r.recipientId })), skipDuplicates: true });
      await prisma.userNotification.createMany({ data: fresh.map((r) => ({ recipientType: r.recipientType, recipientId: r.recipientId, type: notice.type, title: notice.title, body: notice.body, url: notice.url })) });
      sent += fresh.length;
      if (list.length <= PUSH_LIMIT) await Promise.all(fresh.map((r) => sendPushForNotification(r.recipientType, r.recipientId, { type: notice.type, title: notice.title, body: notice.body, url: notice.url })));
    }
    return sent;
  } catch (e) {
    console.error("Could not send event notifications:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Tells an event's audience, plus everyone registered, that something happened. */
export async function notifyAudienceAndRegistered(e: NoticeEvent & AudienceInput, kind: NoticeKind, extra: { reason?: string | null } = {}, dedupeKind?: string): Promise<number> {
  try {
    const regs = await prisma.eventRegistration.findMany({ where: { eventId: e.id, status: { in: ["CONFIRMED", "PENDING"] } }, select: { profileId: true } });
    const [audience, profiles] = await Promise.all([
      audienceRecipients(e),
      regs.length ? prisma.profile.findMany({ where: { id: { in: regs.map((r) => r.profileId) } }, select: { traineeId: true, employerId: true, investorId: true, trainingOrganizationId: true, userId: true } }) : [],
    ]);
    const registered: Recipient[] = [];
    for (const p of profiles) {
      if (p.traineeId) registered.push({ recipientType: "TRAINEE", recipientId: p.traineeId });
      else if (p.employerId) registered.push({ recipientType: "EMPLOYER", recipientId: p.employerId });
      else if (p.investorId) registered.push({ recipientType: "INVESTOR", recipientId: p.investorId });
      else if (p.trainingOrganizationId) registered.push({ recipientType: "TRAINING_ORG", recipientId: p.trainingOrganizationId });
      else if (p.userId) registered.push({ recipientType: "STAFF", recipientId: p.userId });
    }
    // A cancellation or a new time goes to everyone it concerns; an announcement goes to the audience only.
    const concerns = kind === "CANCELLED" || kind === "RESCHEDULED";
    return sendNotice(e.id, kind, concerns ? [...audience, ...registered] : audience, noticeFor(kind, e, extra), { dedupeKind });
  } catch (err) {
    console.error("Could not notify an event's audience:", err instanceof Error ? err.message : err);
    return 0;
  }
}

/** Resolves a profile to the notification address of its account. */
export async function recipientOfProfile(profileId: string): Promise<Recipient | null> {
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { traineeId: true, employerId: true, investorId: true, trainingOrganizationId: true, userId: true } });
  if (!p) return null;
  if (p.traineeId) return { recipientType: "TRAINEE", recipientId: p.traineeId };
  if (p.employerId) return { recipientType: "EMPLOYER", recipientId: p.employerId };
  if (p.investorId) return { recipientType: "INVESTOR", recipientId: p.investorId };
  if (p.trainingOrganizationId) return { recipientType: "TRAINING_ORG", recipientId: p.trainingOrganizationId };
  if (p.userId) return { recipientType: "STAFF", recipientId: p.userId };
  return null;
}
