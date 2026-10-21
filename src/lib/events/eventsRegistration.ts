import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/rbac/audit";
import type { SessionPayload } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { formatWhen, hasRoom, phaseOf, registrationDecision, type RegistrationStatus } from "@/lib/events/eventsCore";
import { EventsError, assertEnabled, getEventSettings, loadViewer, profileOf, type Actor } from "@/lib/events/eventsAccess";
import { rightsOf } from "@/lib/events/events";
import { noticeFor } from "@/lib/events/eventsNotices";
import { promotionReviewers, recipientOfProfile, sendNotice } from "@/lib/events/eventsNotify";

/** Registration, the registers organisers keep, and the participant export. Personal details go only to people who manage the event. */

async function eventFor(id: string) {
  const e = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, audience: true, promotionStatus: true, publishAt: true, trainingOrganizationId: true, startsAt: true, endsAt: true, timeZone: true, managedBy: true,
      registrationMode: true, capacity: true, registrationDeadline: true, registrationUrl: true, targets: { select: { kind: true, refId: true } }, trainingOrganization: { select: { name: true } },
    },
  });
  if (!e) throw new EventsError("That event was not found.", 404);
  return e;
}
const noticeEvent = (e: Awaited<ReturnType<typeof eventFor>>) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timeZone: e.timeZone, organizer: e.trainingOrganization?.name ?? "AAICBI" });
const asViewable = (e: Awaited<ReturnType<typeof eventFor>>) => ({ ...e, targets: e.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })) });

/** A person registers (or asks to attend, when the organiser approves places). Capacity is checked inside a lock so two people cannot take the last place. */
export async function register(session: SessionPayload | null, eventId: string, attendanceMode?: unknown): Promise<{ status: RegistrationStatus }> {
  if (!session) throw new EventsError("Sign in to register.", 401);
  const settings = await getEventSettings();
  if (!settings.enabled) throw new EventsError("The Event Manager is switched off.", 403);
  const [e, viewer, profile] = await Promise.all([eventFor(eventId), loadViewer(session), profileOf(session)]);
  if (!profile) throw new EventsError("Your account cannot register for events.", 403);
  const mode = attendanceMode === "ONLINE" || attendanceMode === "PHYSICAL" ? attendanceMode : null;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const existing = await tx.eventRegistration.findUnique({ where: { eventId_profileId: { eventId, profileId: profile.id } }, select: { status: true } });
    const confirmed = await tx.eventRegistration.count({ where: { eventId, status: "CONFIRMED" } });
    const d = registrationDecision({ ...asViewable(e) }, viewer, existing ? { status: existing.status as RegistrationStatus } : null, confirmed, settings.registrationEnabled && (e.trainingOrganizationId === null || settings.orgEventsEnabled), new Date());
    if (!d.ok || !d.status) throw new EventsError(d.reason ?? "You cannot register for this event.", 409);
    await tx.eventRegistration.upsert({
      where: { eventId_profileId: { eventId, profileId: profile.id } },
      create: { eventId, profileId: profile.id, status: d.status, attendanceMode: mode },
      update: { status: d.status, attendanceMode: mode, attended: false, attendedMarkedAt: null, attendedMarkedById: null, decidedById: null },
    });
    return d.status;
  });
  const ne = noticeEvent(e);
  const me = await recipientOfProfile(profile.id);
  if (me) await sendNotice(eventId, result === "CONFIRMED" ? "REGISTERED" : "REGISTRATION_PENDING", [me], noticeFor(result === "CONFIRMED" ? "REGISTERED" : "REGISTRATION_PENDING", ne), { dedupeKind: `${result === "CONFIRMED" ? "REGISTERED" : "REGISTRATION_PENDING"}:${Date.now()}` });
  if (result === "PENDING") {
    const who = e.trainingOrganizationId ? [{ recipientType: "TRAINING_ORG" as const, recipientId: e.trainingOrganizationId }] : await promotionReviewers();
    await sendNotice(eventId, "REGISTRATION_REQUEST", who, noticeFor("REGISTRATION_REQUEST", ne, { manageUrl: e.trainingOrganizationId ? `/admin/organization/events/${eventId}?tab=registrations` : `/admin/events/${eventId}?tab=registrations` }), { dedupeKind: `REGISTRATION_REQUEST:${profile.id}:${Date.now()}` });
  }
  return { status: result };
}

export async function cancelMyRegistration(session: SessionPayload | null, eventId: string): Promise<void> {
  if (!session) throw new EventsError("Sign in first.", 401);
  const [e, profile] = await Promise.all([eventFor(eventId), profileOf(session)]);
  if (!profile) throw new EventsError("Your account cannot register for events.", 403);
  if (phaseOf(e, new Date()) === "COMPLETED") throw new EventsError("That event has finished.", 409);
  const r = await prisma.eventRegistration.updateMany({ where: { eventId, profileId: profile.id, status: { in: ["CONFIRMED", "PENDING"] } }, data: { status: "CANCELLED", attended: false, attendedMarkedAt: null } });
  if (r.count === 0) throw new EventsError("You are not registered.", 409);
}

interface Who { name: string; kind: string; email: string | null; handle: string }
async function whoAre(profileIds: string[]): Promise<Map<string, Who>> {
  const profiles = profileIds.length ? await prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, handle: true, traineeId: true, employerId: true, investorId: true, trainingOrganizationId: true, userId: true } }) : [];
  const ids = (k: "traineeId" | "employerId" | "investorId" | "trainingOrganizationId" | "userId") => profiles.map((p) => p[k]).filter((x): x is string => !!x);
  const [t, em, inv, org, u] = await Promise.all([
    prisma.trainee.findMany({ where: { id: { in: ids("traineeId") } }, select: { id: true, name: true, email: true } }),
    prisma.employer.findMany({ where: { id: { in: ids("employerId") } }, select: { id: true, companyName: true, email: true } }),
    prisma.investor.findMany({ where: { id: { in: ids("investorId") } }, select: { id: true, name: true, email: true } }),
    prisma.trainingOrganization.findMany({ where: { id: { in: ids("trainingOrganizationId") } }, select: { id: true, name: true, email: true } }),
    prisma.user.findMany({ where: { id: { in: ids("userId") } }, select: { id: true, name: true, email: true } }),
  ]);
  const M = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const [mt, me, mi, mo, mu] = [M(t), M(em), M(inv), M(org), M(u)];
  const out = new Map<string, Who>();
  for (const p of profiles) {
    let w: Who = { name: "Unknown", kind: "Account", email: null, handle: p.handle };
    if (p.traineeId && mt.get(p.traineeId)) { const r = mt.get(p.traineeId)!; w = { name: r.name, kind: "Trainee", email: r.email, handle: p.handle }; }
    else if (p.employerId && me.get(p.employerId)) { const r = me.get(p.employerId)!; w = { name: r.companyName, kind: "Employer", email: r.email, handle: p.handle }; }
    else if (p.investorId && mi.get(p.investorId)) { const r = mi.get(p.investorId)!; w = { name: r.name, kind: "Investor", email: r.email, handle: p.handle }; }
    else if (p.trainingOrganizationId && mo.get(p.trainingOrganizationId)) { const r = mo.get(p.trainingOrganizationId)!; w = { name: r.name, kind: "Organisation", email: r.email, handle: p.handle }; }
    else if (p.userId && mu.get(p.userId)) { const r = mu.get(p.userId)!; w = { name: r.name, kind: "AAICBI staff", email: r.email, handle: p.handle }; }
    out.set(p.id, w);
  }
  return out;
}

export interface RegistrationRow { id: string; name: string; kind: string; handle: string; status: RegistrationStatus; attendanceMode: string | null; attended: boolean; registeredAt: string }

async function manageable(a: Actor, eventId: string, want: "registrations" | "exportList") {
  const e = await eventFor(eventId);
  const rights = rightsOf(a, e);
  if (!rights.read) throw new EventsError("That event was not found.", 404);
  if (!rights[want]) throw new EventsError("You do not have permission to see the participants of this event.", 403);
  return e;
}

export async function listRegistrations(a: Actor, eventId: string): Promise<{ rows: RegistrationRow[]; capacity: number | null; confirmed: number; pending: number; attended: number }> {
  const e = await manageable(a, eventId, "registrations");
  const regs = await prisma.eventRegistration.findMany({ where: { eventId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 2000 });
  const who = await whoAre(regs.map((r) => r.profileId));
  const rows = regs.map((r): RegistrationRow => ({ id: r.id, name: who.get(r.profileId)?.name ?? "Unknown", kind: who.get(r.profileId)?.kind ?? "Account", handle: who.get(r.profileId)?.handle ?? "", status: r.status as RegistrationStatus, attendanceMode: r.attendanceMode, attended: r.attended, registeredAt: r.createdAt.toISOString() }));
  return { rows, capacity: e.capacity, confirmed: rows.filter((r) => r.status === "CONFIRMED").length, pending: rows.filter((r) => r.status === "PENDING").length, attended: rows.filter((r) => r.attended && r.status === "CONFIRMED").length };
}

/** Confirms or declines a registration that waits for approval (or reverses a confirmation). */
export async function decideRegistration(a: Actor, registrationId: string, decision: "confirm" | "decline", reason?: string): Promise<void> {
  await assertEnabled(a);
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new EventsError("That registration was not found.", 404);
  const e = await manageable(a, reg.eventId, "registrations");
  const why = (reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!(a.kind === "ORGANIZATION" ? a.permissions.has("org_events.registrations:manage") : a.permissions.has("events.registrations:manage"))) throw new EventsError("You do not have permission to decide registrations.", 403);
  if (decision === "decline" && why.length < 3) throw new EventsError("Give a short reason so the person knows why.", 422, { reason: "Give a reason." });
  if (decision === "confirm") {
    if (reg.status === "CONFIRMED") return;
    const confirmed = await prisma.eventRegistration.count({ where: { eventId: reg.eventId, status: "CONFIRMED" } });
    if (!hasRoom(e.capacity, confirmed)) throw new EventsError("The event is full. Raise the capacity first.", 409);
  }
  await prisma.eventRegistration.update({ where: { id: registrationId }, data: { status: decision === "confirm" ? "CONFIRMED" : "DECLINED", decidedById: a.userId, ...(decision === "decline" ? { attended: false, attendedMarkedAt: null } : {}) } });
  await recordAudit({ actorId: a.userId, actorRole: a.kind === "ORGANIZATION" ? "ORGANIZATION" : a.session.role, action: decision === "confirm" ? "EVENT_REGISTRATION_CONFIRMED" : "EVENT_REGISTRATION_DECLINED", resourceType: "event", resourceId: e.id, organizationId: e.trainingOrganizationId, reason: why || null });
  const to = await recipientOfProfile(reg.profileId);
  const kind = decision === "confirm" ? "REGISTRATION_CONFIRMED" : "REGISTRATION_DECLINED";
  if (to) await sendNotice(e.id, kind, [to], noticeFor(kind, noticeEvent(e), { reason: why }), { dedupeKind: `${kind}:${Date.now()}` });
}

/** The attendance register: set by a person, never by a join link. */
export async function markAttendance(a: Actor, registrationId: string, attended: boolean): Promise<void> {
  await assertEnabled(a);
  const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new EventsError("That registration was not found.", 404);
  const e = await manageable(a, reg.eventId, "registrations");
  if (!(a.kind === "ORGANIZATION" ? a.permissions.has("org_events.registrations:manage") : a.permissions.has("events.registrations:manage"))) throw new EventsError("You do not have permission to keep the attendance register.", 403);
  if (reg.status !== "CONFIRMED") throw new EventsError("Only confirmed registrations can be marked.", 409);
  if (new Date().getTime() < e.startsAt.getTime()) throw new EventsError("Attendance can be marked once the event has started.", 409);
  await prisma.eventRegistration.update({ where: { id: registrationId }, data: { attended, attendedMarkedAt: attended ? new Date() : null, attendedMarkedById: attended ? a.userId : null } });
}

/** A spreadsheet of participants, for people allowed to export. Cells that could be run as formulas are made safe. */
export async function exportRegistrations(a: Actor, eventId: string): Promise<{ filename: string; csv: string }> {
  const e = await manageable(a, eventId, "exportList");
  const regs = await prisma.eventRegistration.findMany({ where: { eventId }, orderBy: { createdAt: "asc" }, take: 5000 });
  const who = await whoAre(regs.map((r) => r.profileId));
  const csv = toCsv(["Name", "Account type", "Email", "Status", "Attendance mode", "Registered", "Attended"], regs.map((r) => [
    who.get(r.profileId)?.name ?? "", who.get(r.profileId)?.kind ?? "", who.get(r.profileId)?.email ?? "", r.status, r.attendanceMode ?? "", r.createdAt, r.attended ? "Yes" : "No",
  ]));
  await recordAudit({ actorId: a.userId, actorRole: a.kind === "ORGANIZATION" ? "ORGANIZATION" : a.session.role, action: "EVENT_REGISTRATIONS_EXPORTED", resourceType: "event", resourceId: e.id, organizationId: e.trainingOrganizationId });
  const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
  return { filename: `${slug}-participants.csv`, csv };
}

/** The events this person registered for that are still ahead, for their dashboard. */
export async function myUpcomingRegistrations(session: SessionPayload, take = 5) {
  const profile = await profileOf(session);
  if (!profile) return [];
  const rows = await prisma.eventRegistration.findMany({
    where: { profileId: profile.id, status: { in: ["CONFIRMED", "PENDING"] }, event: { status: "SCHEDULED", endsAt: { gt: new Date() } } },
    orderBy: { event: { startsAt: "asc" } }, take,
    select: { status: true, event: { select: { id: true, title: true, startsAt: true, endsAt: true, timeZone: true, delivery: true, venueName: true, city: true, trainingOrganization: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ status: r.status as RegistrationStatus, id: r.event.id, title: r.event.title, when: formatWhen(r.event.startsAt, r.event.endsAt, r.event.timeZone), startsAt: r.event.startsAt.toISOString(), delivery: r.event.delivery, place: [r.event.venueName, r.event.city].filter(Boolean).join(", ") || null, organizer: r.event.trainingOrganization?.name ?? "AAICBI" }));
}
