import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/rbac/audit";
import type { SessionPayload } from "@/lib/auth/session";
import {
  ANON, canChangeStatus, canView, changesPromo, embedFor, isPublished, joinDecision, nextPromotion, overlaps, phaseOf, promotionLabel, registrationDecision, validateEvent,
  PROMOTION_ACTIONS_NEED_REASON, ORG_PROMOTION_ACTIONS, DAY_MS, utcToLocalInput,
  type Audience, type Delivery, type EventValue, type Phase, type Promotion, type PromotionAction, type RegistrationMode, type RegistrationStatus, type Status, type Viewer,
} from "@/lib/events/eventsCore";
import { decryptPasscode, encryptPasscode } from "@/lib/events/eventsCrypto";
import { EventsError, assertEnabled, getEventSettings, loadViewer, need, profileOf, type Actor } from "@/lib/events/eventsAccess";
import { noticeFor, type NoticeEvent } from "@/lib/events/eventsNotices";
import { audienceRecipients, notifyAudienceAndRegistered, promotionReviewers, sendNotice, type Recipient } from "@/lib/events/eventsNotify";

// ---------------------------------------------------------------------------------------------------------------- shapes

const ROW = {
  id: true, trainingOrganizationId: true, createdByUserId: true, createdByLabel: true, managedBy: true, title: true, summary: true, description: true, categoryId: true, eventType: true,
  startsAt: true, endsAt: true, timeZone: true, registrationDeadline: true, capacity: true, delivery: true, venueName: true, address: true, city: true, state: true, directions: true,
  mapUrl: true, attendanceNotes: true, conferenceProvider: true, status: true, audience: true, registrationMode: true, registrationNotes: true, registrationUrl: true,
  hybridSeparateRegistration: true, flyerUrl: true, videoUrl: true, videoKind: true, promotionStatus: true, promotionNote: true, promotionRequestedAt: true, publishAt: true, publishedAt: true,
  cancelledAt: true, cancelReason: true, joinOpensMinutes: true, isDemo: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  trainingOrganization: { select: { id: true, name: true, logoUrl: true, publicProfile: { select: { slug: true } } } },
  targets: { select: { kind: true, refId: true } },
  media: { select: { id: true, kind: true, url: true, mimeType: true, caption: true }, orderBy: { sortOrder: "asc" as const } },
  joinInfo: { select: { eventId: true } },
} satisfies Prisma.EventSelect;
type Row = Prisma.EventGetPayload<{ select: typeof ROW }>;

export interface EventView {
  id: string; title: string; summary: string | null; description: string | null; eventType: string;
  category: { id: string; name: string; slug: string } | null;
  startsAt: string; endsAt: string; timeZone: string; startLocal: string; endLocal: string; registrationDeadline: string | null; registrationDeadlineLocal: string | null;
  capacity: number | null; confirmedCount: number | null;
  delivery: Delivery; venueName: string | null; address: string | null; city: string | null; state: string | null; directions: string | null; mapUrl: string | null; attendanceNotes: string | null;
  conferenceProvider: string | null; hasJoinInfo: boolean;
  status: Status; phase: Phase; audience: Audience; registrationMode: RegistrationMode; registrationNotes: string | null; registrationUrl: string | null; hybridSeparateRegistration: boolean;
  flyerUrl: string | null; videoUrl: string | null; videoKind: string | null; embedUrl: string | null;
  media: { id: string; kind: string; url: string; mimeType: string | null; caption: string | null }[];
  organizer: { kind: "AAICBI" | "ORGANIZATION"; id: string | null; name: string; slug: string | null; logoUrl: string | null; promotedByAaicbi: boolean };
  published: boolean; publishedAt: string | null; publishAt: string | null;
  cancelReason: string | null; joinOpensMinutes: number | null;
  // Only filled for people who manage the event.
  managed: { managedBy: string; promotionStatus: Promotion; promotionLabel: string; promotionNote: string | null; promotionRequestedAt: string | null; targets: { kind: string; refId: string }[]; createdByLabel: string | null; isDemo: boolean } | null;
}

function organizerOf(r: Row): EventView["organizer"] {
  if (!r.trainingOrganization) return { kind: "AAICBI", id: null, name: "AAICBI", slug: null, logoUrl: null, promotedByAaicbi: false };
  return { kind: "ORGANIZATION", id: r.trainingOrganization.id, name: r.trainingOrganization.name, slug: r.trainingOrganization.publicProfile?.slug ?? null, logoUrl: r.trainingOrganization.logoUrl, promotedByAaicbi: r.managedBy === "PLATFORM" };
}

export function toView(r: Row, now: Date, o: { manager: boolean; confirmed?: number | null } = { manager: false }): EventView {
  const embed = r.videoKind === "EXTERNAL" && r.videoUrl ? embedFor(r.videoUrl) : null;
  return {
    id: r.id, title: r.title, summary: r.summary, description: r.description, eventType: r.eventType, category: r.category,
    startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString(), timeZone: r.timeZone, startLocal: utcToLocalInput(r.startsAt, r.timeZone), endLocal: utcToLocalInput(r.endsAt, r.timeZone),
    registrationDeadline: r.registrationDeadline?.toISOString() ?? null, registrationDeadlineLocal: r.registrationDeadline ? utcToLocalInput(r.registrationDeadline, r.timeZone) : null,
    capacity: r.capacity, confirmedCount: o.confirmed ?? null,
    delivery: r.delivery, venueName: r.venueName, address: r.address, city: r.city, state: r.state, directions: r.directions, mapUrl: r.mapUrl, attendanceNotes: r.attendanceNotes,
    conferenceProvider: r.conferenceProvider, hasJoinInfo: !!r.joinInfo,
    status: r.status, phase: phaseOf(r, now), audience: r.audience, registrationMode: r.registrationMode, registrationNotes: r.registrationNotes, registrationUrl: r.registrationUrl, hybridSeparateRegistration: r.hybridSeparateRegistration,
    flyerUrl: r.flyerUrl, videoUrl: r.videoKind === "UPLOAD" || embed ? r.videoUrl : null, videoKind: r.videoKind, embedUrl: embed?.embedUrl ?? null, media: r.media,
    organizer: organizerOf(r), published: isPublished(r, now), publishedAt: r.publishedAt?.toISOString() ?? null, publishAt: r.publishAt?.toISOString() ?? null,
    cancelReason: r.cancelReason, joinOpensMinutes: r.joinOpensMinutes,
    managed: o.manager ? { managedBy: r.managedBy, promotionStatus: r.promotionStatus, promotionLabel: promotionLabel(r, now), promotionNote: r.promotionNote, promotionRequestedAt: r.promotionRequestedAt?.toISOString() ?? null, targets: r.targets, createdByLabel: r.createdByLabel, isDemo: r.isDemo } : null,
  };
}

const viewable = (r: Row) => ({ id: r.id, status: r.status, audience: r.audience, promotionStatus: r.promotionStatus, publishAt: r.publishAt, trainingOrganizationId: r.trainingOrganizationId, startsAt: r.startsAt, endsAt: r.endsAt, targets: r.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })), registrationMode: r.registrationMode });
const noticeEvent = (r: { id: string; title: string; startsAt: Date; endsAt: Date; timeZone: string; trainingOrganization: { name: string } | null }): NoticeEvent => ({ id: r.id, title: r.title, startsAt: r.startsAt, endsAt: r.endsAt, timeZone: r.timeZone, organizer: r.trainingOrganization?.name ?? "AAICBI" });

// ---------------------------------------------------------------------------------------------------------------- what a manager may do

export interface Rights { read: boolean; edit: boolean; cancel: boolean; registrations: boolean; exportList: boolean; joinInfo: boolean; promotionReview: boolean }
const NO_RIGHTS: Rights = { read: false, edit: false, cancel: false, registrations: false, exportList: false, joinInfo: false, promotionReview: false };

/** What this manager may do with this event. Organization people only ever reach their own organization's events; platform staff reach what their permissions name. */
export function rightsOf(a: Actor | null, e: { trainingOrganizationId: string | null; managedBy: string; promotionStatus: Promotion }): Rights {
  if (!a) return NO_RIGHTS;
  const has = (k: string) => a.permissions.has(k);
  if (a.kind === "ORGANIZATION") {
    const own = !!a.orgId && e.trainingOrganizationId === a.orgId;
    if (!own) return NO_RIGHTS;
    const orgManaged = e.managedBy === "ORG";
    const edit = orgManaged && has("org_events.events:edit");
    const regs = orgManaged && has("org_events.registrations:view");
    return { read: has("org_events.events:view"), edit, cancel: edit, registrations: regs, exportList: regs && has("org_events.registrations:export"), joinInfo: edit, promotionReview: false };
  }
  const platformManaged = e.managedBy === "PLATFORM";
  const anyPlatform = [...a.permissions].some((k) => k.startsWith("events.platform:"));
  const promo = has("events.promotions:view") && e.promotionStatus !== "NONE";
  const regs = platformManaged && has("events.registrations:view");
  return {
    read: has("events.global:view") || (platformManaged && anyPlatform) || promo, edit: platformManaged && has("events.platform:edit"), cancel: platformManaged && has("events.platform:delete"),
    registrations: regs, exportList: regs && has("events.registrations:export"), joinInfo: platformManaged && has("events.platform:edit"), promotionReview: promo,
  };
}

async function loadRow(id: string): Promise<Row | null> {
  return prisma.event.findUnique({ where: { id }, select: ROW });
}
async function mustLoad(id: string): Promise<Row> {
  const r = await loadRow(id);
  if (!r) throw new EventsError("That event was not found.", 404);
  return r;
}
/** Loads an event the actor may read, or answers "not found" so existence is not revealed. */
async function mustManage(a: Actor, id: string, want: keyof Rights): Promise<{ row: Row; rights: Rights }> {
  const row = await mustLoad(id);
  const rights = rightsOf(a, row);
  if (!rights.read) throw new EventsError("That event was not found.", 404);
  if (!rights[want]) throw new EventsError("You do not have permission to do that with this event.", 403);
  return { row, rights };
}

async function log(eventId: string, a: Actor | null, action: string, note?: string | null) {
  await prisma.eventActivity.create({ data: { eventId, actorId: a?.userId ?? null, actorLabel: a?.label ?? "System", actorKind: a ? (a.kind === "ORGANIZATION" ? "ORGANIZATION" : a.kind) : "SYSTEM", action, note: note ? note.slice(0, 500) : null } }).catch((e) => console.error("Could not write event activity:", e));
}
const audit = (a: Actor, action: string, e: { id: string; trainingOrganizationId: string | null }, reason?: string | null, after?: unknown) =>
  recordAudit({ actorId: a.userId, actorRole: a.kind === "ORGANIZATION" ? "ORGANIZATION" : a.session.role, action, resourceType: "event", resourceId: e.id, organizationId: e.trainingOrganizationId, reason: reason ?? null, after });

// ---------------------------------------------------------------------------------------------------------------- listing

export interface Filters {
  q?: string; categoryId?: string; delivery?: string; organizer?: string; audience?: string; status?: string; promotion?: string; type?: string;
  when?: "upcoming" | "live" | "past" | "all"; from?: string; to?: string; take?: number; page?: number; orgId?: string;
}

function whenWhere(f: Filters, now: Date): Prisma.EventWhereInput[] {
  const out: Prisma.EventWhereInput[] = [];
  if (f.when === "live") out.push({ startsAt: { lte: now }, endsAt: { gt: now } });
  else if (f.when === "past") out.push({ endsAt: { lte: now } });
  else if (f.when === "upcoming" || !f.when) out.push({ endsAt: { gt: now } });
  const from = f.from ? new Date(f.from) : null, to = f.to ? new Date(f.to) : null;
  if (from && !Number.isNaN(from.getTime())) out.push({ endsAt: { gt: from } });
  if (to && !Number.isNaN(to.getTime())) out.push({ startsAt: { lt: to } });
  return out;
}
function commonWhere(f: Filters): Prisma.EventWhereInput[] {
  const out: Prisma.EventWhereInput[] = [];
  const q = f.q?.trim().slice(0, 80);
  if (q) out.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { venueName: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { trainingOrganization: { name: { contains: q, mode: "insensitive" } } }] });
  if (f.categoryId) out.push({ categoryId: f.categoryId });
  if (f.audience === "PUBLIC") out.push({ audience: "PUBLIC" });
  else if (f.audience === "RESTRICTED") out.push({ audience: { not: "PUBLIC" } });
  if (f.type) out.push({ eventType: f.type });
  if (f.delivery === "PHYSICAL" || f.delivery === "ONLINE" || f.delivery === "HYBRID") out.push({ delivery: f.delivery });
  if (f.organizer === "platform") out.push({ trainingOrganizationId: null });
  else if (f.organizer) out.push({ trainingOrganizationId: f.organizer });
  return out;
}

export const publicWhere = (now: Date): Prisma.EventWhereInput => ({
  status: "SCHEDULED", audience: "PUBLIC",
  AND: [{ OR: [{ promotionStatus: "PUBLISHED" }, { promotionStatus: "APPROVED", publishAt: { lte: now } }] }, { OR: [{ trainingOrganizationId: null }, { trainingOrganization: { approvalState: "APPROVED" } }] }],
});

async function counts(ids: string[], profileId: string | null) {
  if (!ids.length) return { confirmed: new Map<string, number>(), mine: new Map<string, RegistrationStatus>() };
  const [g, mine] = await Promise.all([
    prisma.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: ids }, status: "CONFIRMED" }, _count: { _all: true } }),
    profileId ? prisma.eventRegistration.findMany({ where: { eventId: { in: ids }, profileId }, select: { eventId: true, status: true } }) : [],
  ]);
  return { confirmed: new Map(g.map((x) => [x.eventId, x._count._all])), mine: new Map(mine.map((m) => [m.eventId, m.status as RegistrationStatus])) };
}

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ListedEvent extends EventView { myRegistration: RegistrationStatus | null }

/** Events a person may see, newest first for the past and soonest first for what is coming. Visitors get only published public events. */
export async function listVisibleEvents(session: SessionPayload | null, f: Filters = {}): Promise<Page<ListedEvent>> {
  const now = new Date();
  const [settings, viewer] = await Promise.all([getEventSettings(), loadViewer(session)]);
  if (!settings.enabled) return { items: [], total: 0, page: 1, pageSize: f.take ?? 20 };
  const f2: Filters = { ...f, when: !settings.showPast && f.when === "past" ? "upcoming" : f.when };
  const pageSize = Math.min(Math.max(f.take ?? 20, 1), 60), page = Math.max(f.page ?? 1, 1);
  const ors: Prisma.EventWhereInput[] = [publicWhere(now)];
  if (viewer.signedIn) {
    if (viewer.seesAll) ors.push({ status: { in: ["SCHEDULED", "CANCELLED"] } });
    if (viewer.memberOrgIds.length) ors.push({ trainingOrganizationId: { in: viewer.memberOrgIds }, audience: { in: ["ORG_MEMBERS", "PUBLIC"] } }, { trainingOrganizationId: null, audience: "ORG_MEMBERS" });
    if (viewer.staffOrgId) ors.push({ trainingOrganizationId: viewer.staffOrgId }, { trainingOrganizationId: null, audience: { in: ["ORG_STAFF", "ORG_MEMBERS"] } });
    const tk: Prisma.EventTargetWhereInput[] = [
      ...(viewer.cohortIds.length ? [{ kind: "COHORT", refId: { in: viewer.cohortIds } }] : []), ...(viewer.courseIds.length ? [{ kind: "COURSE", refId: { in: viewer.courseIds } }] : []),
      ...(viewer.traineeId ? [{ kind: "TRAINEE", refId: viewer.traineeId }] : []), ...(viewer.profileId ? [{ kind: "PROFILE", refId: viewer.profileId }] : []),
    ];
    if (tk.length) ors.push({ targets: { some: { OR: tk } } });
  }
  const where: Prisma.EventWhereInput = { status: { in: ["SCHEDULED", "CANCELLED"] }, AND: [{ OR: ors }, ...commonWhere(f2), ...whenWhere(f2, now)] };
  const rows = await prisma.event.findMany({ where, select: ROW, orderBy: { startsAt: f2.when === "past" ? "desc" : "asc" }, take: 400 });
  const visible = rows.filter((r) => canView(viewable(r), viewer, now));
  const slice = visible.slice((page - 1) * pageSize, page * pageSize);
  const c = await counts(slice.map((r) => r.id), viewer.profileId);
  return { items: slice.map((r) => ({ ...toView(r, now, { manager: false, confirmed: r.capacity !== null ? c.confirmed.get(r.id) ?? 0 : null }), myRegistration: c.mine.get(r.id) ?? null })), total: visible.length, page, pageSize };
}

/** The next few published public events: for the feed, the landing page and the mobile home. Never includes anything private. */
export async function listPublishedPublic(opts: { take?: number; q?: string; organizationId?: string } = {}): Promise<EventView[]> {
  const settings = await getEventSettings();
  if (!settings.enabled) return [];
  const now = new Date();
  const where: Prisma.EventWhereInput = { AND: [publicWhere(now), { endsAt: { gt: now } }, ...commonWhere({ q: opts.q }), ...(opts.organizationId ? [{ trainingOrganizationId: opts.organizationId }] : [])] };
  const rows = await prisma.event.findMany({ where, select: ROW, orderBy: { startsAt: "asc" }, take: Math.min(opts.take ?? 10, 60) });
  return rows.map((r) => toView(r, now));
}

export interface ManagedRow extends EventView { rights: Rights; registrationCounts: { confirmed: number; pending: number } }

/** Everything the actor may manage or read, for the Event Manager lists and calendars. */
export async function listManagedEvents(a: Actor, f: Filters = {}): Promise<Page<ManagedRow>> {
  const now = new Date();
  const pageSize = Math.min(Math.max(f.take ?? 50, 1), 200), page = Math.max(f.page ?? 1, 1);
  const and: Prisma.EventWhereInput[] = [...commonWhere(f), ...whenWhere({ ...f, when: f.when ?? "all" }, now)];
  if (a.kind === "ORGANIZATION") and.push({ trainingOrganizationId: a.orgId ?? "none" });
  else if (!a.permissions.has("events.global:view")) {
    const ors: Prisma.EventWhereInput[] = [];
    if ([...a.permissions].some((k) => k.startsWith("events.platform:"))) ors.push({ managedBy: "PLATFORM" });
    if (a.permissions.has("events.promotions:view")) ors.push({ promotionStatus: { not: "NONE" } });
    and.push(ors.length ? { OR: ors } : { id: "none" });
  }
  if (f.organizer === undefined && f.orgId) and.push({ trainingOrganizationId: f.orgId });
  if (f.status && ["DRAFT", "SCHEDULED", "CANCELLED", "ARCHIVED"].includes(f.status)) and.push({ status: f.status as Status });
  else and.push({ status: { not: "ARCHIVED" } });
  if (f.audience && ["PUBLIC", "ORG_MEMBERS", "SELECTED_TRAINEES", "ORG_STAFF", "INVITED", "PRIVATE"].includes(f.audience)) and.push({ audience: f.audience as Audience });
  if (f.promotion && ["NONE", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "REJECTED"].includes(f.promotion)) and.push({ promotionStatus: f.promotion as Promotion });
  const where: Prisma.EventWhereInput = { AND: and };
  const [total, rows] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({ where, select: ROW, orderBy: { startsAt: f.when === "past" ? "desc" : "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const ids = rows.map((r) => r.id);
  const reg = ids.length ? await prisma.eventRegistration.groupBy({ by: ["eventId", "status"], where: { eventId: { in: ids }, status: { in: ["CONFIRMED", "PENDING"] } }, _count: { _all: true } }) : [];
  const items = rows.map((r): ManagedRow => {
    const rights = rightsOf(a, r);
    const n = (s: string) => reg.find((x) => x.eventId === r.id && x.status === s)?._count._all ?? 0;
    return { ...toView(r, now, { manager: true }), rights, registrationCounts: { confirmed: n("CONFIRMED"), pending: n("PENDING") } };
  });
  return { items, total, page, pageSize };
}

// ---------------------------------------------------------------------------------------------------------------- one event

export interface EventDetail {
  event: EventView;
  me: {
    signedIn: boolean; registration: RegistrationStatus | null; canRegister: boolean; registerReason: string | null;
    join: { available: boolean; reason: string | null; opensAt: string | null };
  };
  rights: Rights | null;
  registrationCounts: { confirmed: number; pending: number } | null;
}

/** An event for the person looking at it, or null when they may not see it (never reveals that it exists). Never includes joining details. */
export async function eventDetail(id: string, session: SessionPayload | null, actor: Actor | null = null): Promise<EventDetail | null> {
  const row = await loadRow(id);
  if (!row) return null;
  const now = new Date();
  const [settings, viewer] = await Promise.all([getEventSettings(), loadViewer(session)]);
  if (!settings.enabled) return null;
  const rights = rightsOf(actor, row);
  if (!rights.read && !canView(viewable(row), viewer, now)) return null;
  const [confirmed, pending, mine] = await Promise.all([
    prisma.eventRegistration.count({ where: { eventId: id, status: "CONFIRMED" } }),
    rights.registrations ? prisma.eventRegistration.count({ where: { eventId: id, status: "PENDING" } }) : 0,
    viewer.profileId ? prisma.eventRegistration.findUnique({ where: { eventId_profileId: { eventId: id, profileId: viewer.profileId } }, select: { status: true } }) : null,
  ]);
  const reg = mine ? { status: mine.status as RegistrationStatus } : null;
  const regOn = settings.registrationEnabled && (row.trainingOrganizationId === null || settings.orgEventsEnabled);
  const decision = registrationDecision({ ...viewable(row), capacity: row.capacity, registrationDeadline: row.registrationDeadline, registrationUrl: row.registrationUrl }, viewer, reg, confirmed, regOn, now);
  const jd = joinDecision({ ...viewable(row), delivery: row.delivery, joinOpensMinutes: row.joinOpensMinutes }, viewer, reg, rights.joinInfo, settings.joinOpensMinutes, now);
  return {
    event: toView(row, now, { manager: rights.read, confirmed: row.capacity !== null || rights.registrations ? confirmed : null }),
    me: { signedIn: viewer.signedIn, registration: reg?.status ?? null, canRegister: decision.ok, registerReason: decision.ok ? null : decision.reason ?? null, join: { available: jd.allowed, reason: jd.reason, opensAt: jd.opensAt?.toISOString() ?? null } },
    rights: rights.read ? rights : null,
    registrationCounts: rights.registrations ? { confirmed, pending } : null,
  };
}

export interface JoinDetails { provider: string | null; meetingUrl: string; meetingId: string | null; passcode: string | null; instructions: string | null }

/** The way into an online session, only for a person who may join right now (or who manages the event). Never logged as attendance. */
export async function joinDetails(id: string, session: SessionPayload | null, actor: Actor | null): Promise<JoinDetails> {
  const row = await mustLoad(id);
  const now = new Date();
  const [settings, viewer] = await Promise.all([getEventSettings(), loadViewer(session)]);
  const rights = rightsOf(actor, row);
  const reg = viewer.profileId ? await prisma.eventRegistration.findUnique({ where: { eventId_profileId: { eventId: id, profileId: viewer.profileId } }, select: { status: true } }) : null;
  const d = joinDecision({ ...viewable(row), delivery: row.delivery, joinOpensMinutes: row.joinOpensMinutes }, viewer, reg ? { status: reg.status as RegistrationStatus } : null, rights.joinInfo, settings.joinOpensMinutes, now);
  if (!d.allowed) throw new EventsError(d.reason ?? "You cannot join this event.", d.reason === "Sign in to see how to join." ? 401 : 403);
  const j = await prisma.eventJoinInfo.findUnique({ where: { eventId: id } });
  if (!j) throw new EventsError("The organiser has not added a meeting link yet.", 404);
  return { provider: row.conferenceProvider, meetingUrl: j.meetingUrl, meetingId: j.meetingId, passcode: decryptPasscode(j.passcodeEnc), instructions: j.instructions };
}

/** What the edit form needs beyond the public view: the meeting link and instructions (never the passcode). */
export async function manageDetail(a: Actor, id: string): Promise<{ event: EventView; rights: Rights; join: { meetingUrl: string; meetingId: string | null; instructions: string | null; hasPasscode: boolean } | null; history: { id: string; at: string; who: string; action: string; note: string | null }[] }> {
  const { row, rights } = await mustManage(a, id, "read");
  const j = rights.joinInfo ? await prisma.eventJoinInfo.findUnique({ where: { eventId: id } }) : null;
  const hist = await prisma.eventActivity.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" }, take: 60 });
  return {
    event: toView(row, new Date(), { manager: true }), rights,
    join: j ? { meetingUrl: j.meetingUrl, meetingId: j.meetingId, instructions: j.instructions, hasPasscode: !!j.passcodeEnc } : null,
    history: hist.map((h) => ({ id: h.id, at: h.createdAt.toISOString(), who: h.actorLabel ?? "System", action: h.action, note: h.note })),
  };
}

// ---------------------------------------------------------------------------------------------------------------- create and edit

export type SaveAction = "save" | "schedule" | "submit";
export interface SaveResult { event: EventView; warnings: string[]; conflicts: string[] }

async function conflictsFor(orgId: string | null, startsAt: Date, endsAt: Date, exceptId?: string): Promise<string[]> {
  const rows = await prisma.event.findMany({ where: { status: "SCHEDULED", trainingOrganizationId: orgId, ...(exceptId ? { id: { not: exceptId } } : {}), startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { title: true, startsAt: true, endsAt: true }, take: 5 });
  return rows.filter((r) => overlaps(r, { startsAt, endsAt })).map((r) => r.title);
}

async function checkTargets(v: EventValue, orgId: string | null, a: Actor) {
  if (!v.targets.length) return;
  const ids = (k: string) => v.targets.filter((t) => t.kind === k).map((t) => t.refId);
  // An organization may only pick its own cohorts, courses and trainees. Platform staff may pick any.
  const owner = a.kind === "ORGANIZATION" ? (await prisma.trainingOrganization.findUnique({ where: { id: a.orgId ?? "" }, select: { staffUserId: true } }))?.staffUserId : null;
  if (ids("COURSE").length) {
    const n = await prisma.course.count({ where: { id: { in: ids("COURSE") }, ...(a.kind === "ORGANIZATION" ? { createdById: owner ?? "none" } : orgId ? { createdBy: { trainingOrgAsStaffUser: { id: orgId } } } : {}) } });
    if (n !== ids("COURSE").length) throw new EventsError("One of the chosen courses is not available to you.", 400, { targets: "One of the chosen courses is not available to you." });
  }
  if (ids("COHORT").length) {
    const n = await prisma.cohort.count({ where: { id: { in: ids("COHORT") }, ...(a.kind === "ORGANIZATION" ? { course: { createdById: owner ?? "none" } } : {}) } });
    if (n !== ids("COHORT").length) throw new EventsError("One of the chosen cohorts is not available to you.", 400, { targets: "One of the chosen cohorts is not available to you." });
  }
  if (ids("TRAINEE").length && a.kind === "ORGANIZATION") {
    const n = await prisma.courseEnrollment.findMany({ where: { traineeId: { in: ids("TRAINEE") }, course: { createdById: owner ?? "none" } }, select: { traineeId: true }, distinct: ["traineeId"] });
    if (n.length !== ids("TRAINEE").length) throw new EventsError("You can only choose your own trainees.", 400, { targets: "You can only choose your own trainees." });
  }
  if (ids("PROFILE").length && a.kind === "ORGANIZATION") throw new EventsError("An organization invites its own trainees, courses and cohorts.", 400, { targets: "Choose from your own trainees, courses and cohorts." });
}

/**
 * Creates or changes an event. Platform staff create AAICBI's own events or events promoted on an organisation's behalf; an organisation
 * creates its own. Everything is validated again here: the form's checks are for convenience, this is the authority.
 */
export async function saveEvent(a: Actor, input: { id?: string; data: unknown; action: SaveAction; organizationId?: string | null }): Promise<SaveResult> {
  const settings = await assertEnabled(a);
  const existing = input.id ? await mustLoad(input.id) : null;
  const creating = !existing;
  const org = a.kind === "ORGANIZATION";

  if (creating) await need(a, org ? "org_events.events:create" : "events.platform:create");
  else {
    const rights = rightsOf(a, existing);
    if (!rights.read) throw new EventsError("That event was not found.", 404);
    if (!rights.edit) throw new EventsError("You do not have permission to change this event.", 403);
    const phase = phaseOf(existing, new Date());
    if (phase === "CANCELLED" || phase === "ARCHIVED" || phase === "COMPLETED") throw new EventsError(`A ${phase.toLowerCase()} event cannot be changed. Create a new event instead.`, 409);
  }
  if (input.action === "submit") {
    if (!org) throw new EventsError("Platform events are published, not submitted.", 400);
    await need(a, "org_events.promotion:create");
    if (!settings.promotionsEnabled) throw new EventsError("Public promotion requests are switched off.", 403);
  }

  const wasStatus: Status = existing?.status ?? "DRAFT";
  const toSchedule = input.action === "schedule" || input.action === "submit" || wasStatus === "SCHEDULED";
  const v = validateEvent(input.data, toSchedule ? "schedule" : "draft");
  if (!v.ok || !v.value) throw new EventsError("Please fix the highlighted fields.", 422, v.errors);
  const value = v.value;
  if (input.action === "submit" && value.audience !== "PUBLIC") throw new EventsError("Only an event meant for the public can be submitted for promotion. Choose the Public audience.", 422, { audience: "Choose the Public audience to ask for promotion." });
  if (value.delivery !== "PHYSICAL" && value.join === null && existing?.joinInfo) { /* link kept: the form did not resend it */ }
  if (value.capacity !== null && value.registrationMode === "OPEN") v.warnings.push("A capacity only applies when registration is required.");

  // On behalf of an organisation (platform staff only).
  let ownerOrg: string | null;
  if (org) ownerOrg = a.orgId;
  else if (creating) {
    ownerOrg = input.organizationId || null;
    if (ownerOrg) {
      const o = await prisma.trainingOrganization.findUnique({ where: { id: ownerOrg }, select: { approvalState: true } });
      if (!o || o.approvalState !== "APPROVED") throw new EventsError("Choose an approved training organisation.", 422, { organizationId: "Choose an approved training organisation." });
    }
  } else ownerOrg = existing.trainingOrganizationId;
  await checkTargets(value, ownerOrg, a);

  if (value.categoryId) {
    const c = await prisma.eventCategory.findFirst({ where: { id: value.categoryId, active: true }, select: { id: true } });
    if (!c) throw new EventsError("That category is not available.", 422, { categoryId: "Choose an available category." });
  }

  const conflicts = toSchedule ? await conflictsFor(ownerOrg, value.startsAt, value.endsAt, existing?.id) : [];
  const newStatus: Status = toSchedule ? "SCHEDULED" : "DRAFT";
  const rawPass = (input.data as { passcode?: unknown } | null)?.passcode;

  // What changes about promotion.
  let promotion: Promotion = existing?.promotionStatus ?? "NONE";
  let publishedAt: Date | null = existing?.publishedAt ?? null;
  let publishAt: Date | null = existing?.publishAt ?? null;
  let promoNote: string | null = existing?.promotionNote ?? null;
  let promoRequestedAt: Date | null = existing?.promotionRequestedAt ?? null;
  const events: string[] = [];
  if (existing && org && (promotion === "APPROVED" || promotion === "PUBLISHED")) {
    const before = { title: existing.title, summary: existing.summary, description: existing.description, categoryId: existing.categoryId, eventType: existing.eventType, flyerUrl: existing.flyerUrl, videoUrl: existing.videoUrl, media: existing.media.map((m) => m.url) };
    const after = { title: value.title, summary: value.summary, description: value.description, categoryId: value.categoryId, eventType: value.eventType, flyerUrl: value.flyerUrl, videoUrl: value.videoUrl, media: value.media.map((m) => m.url) };
    if (changesPromo(before, after)) { promotion = "SUBMITTED"; publishedAt = null; publishAt = null; promoNote = null; promoRequestedAt = new Date(); events.push("Promotional wording or pictures changed after approval: sent back for review and taken off the public pages."); }
  }
  if (existing && value.audience !== "PUBLIC" && promotion !== "NONE") { promotion = "NONE"; publishedAt = null; publishAt = null; events.push("Audience is no longer public: promotion cancelled."); }
  if (input.action === "submit") {
    if (promotion === "NONE" || promotion === "CHANGES_REQUESTED" || promotion === "REJECTED") { promotion = "SUBMITTED"; promoNote = null; promoRequestedAt = new Date(); events.push("Submitted for public promotion."); }
  }

  const rescheduled = !!existing && existing.status === "SCHEDULED" && (existing.startsAt.getTime() !== value.startsAt.getTime() || existing.endsAt.getTime() !== value.endsAt.getTime());
  const joinData = value.join;

  const row = await prisma.$transaction(async (tx) => {
    const data = {
      title: value.title, summary: value.summary, description: value.description, categoryId: value.categoryId, eventType: value.eventType,
      startsAt: value.startsAt, endsAt: value.endsAt, timeZone: value.timeZone, registrationDeadline: value.registrationDeadline, capacity: value.capacity,
      delivery: value.delivery, venueName: value.venueName, address: value.address, city: value.city, state: value.state, directions: value.directions, mapUrl: value.mapUrl, attendanceNotes: value.attendanceNotes,
      conferenceProvider: value.conferenceProvider, status: newStatus, audience: value.audience, registrationMode: value.registrationMode, registrationNotes: value.registrationNotes,
      registrationUrl: value.registrationUrl, hybridSeparateRegistration: value.hybridSeparateRegistration, flyerUrl: value.flyerUrl, videoUrl: value.videoUrl, videoKind: value.videoKind,
      promotionStatus: promotion, promotionNote: promoNote, promotionRequestedAt: promoRequestedAt, publishAt, publishedAt, joinOpensMinutes: value.joinOpensMinutes,
    };
    const saved = existing
      ? await tx.event.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.event.create({ data: { ...data, trainingOrganizationId: ownerOrg, managedBy: org ? "ORG" : "PLATFORM", createdByUserId: a.userId, createdByLabel: a.label }, select: { id: true } });
    await tx.eventTarget.deleteMany({ where: { eventId: saved.id } });
    if (value.targets.length) await tx.eventTarget.createMany({ data: value.targets.map((t) => ({ eventId: saved.id, kind: t.kind, refId: t.refId })) });
    await tx.eventMedia.deleteMany({ where: { eventId: saved.id } });
    if (value.media.length) await tx.eventMedia.createMany({ data: value.media.map((m, i) => ({ eventId: saved.id, kind: m.kind, url: m.url, mimeType: m.mimeType, sizeBytes: m.sizeBytes, caption: m.caption, sortOrder: i })) });
    if (value.delivery === "PHYSICAL") await tx.eventJoinInfo.deleteMany({ where: { eventId: saved.id } });
    else if (joinData) {
      const prev = existing ? await tx.eventJoinInfo.findUnique({ where: { eventId: saved.id }, select: { passcodeEnc: true } }) : null;
      const passcodeEnc = rawPass === undefined ? prev?.passcodeEnc ?? null : joinData.passcode ? encryptPasscode(joinData.passcode) : null;
      await tx.eventJoinInfo.upsert({ where: { eventId: saved.id }, create: { eventId: saved.id, meetingUrl: joinData.meetingUrl, meetingId: joinData.meetingId, passcodeEnc, instructions: joinData.instructions }, update: { meetingUrl: joinData.meetingUrl, meetingId: joinData.meetingId, passcodeEnc, instructions: joinData.instructions } });
    }
    return tx.event.findUniqueOrThrow({ where: { id: saved.id }, select: ROW });
  });

  await log(row.id, a, creating ? "Created" : "Edited", toSchedule && wasStatus === "DRAFT" ? "Scheduled" : null);
  for (const e of events) await log(row.id, a, e);
  if (rescheduled && existing) await log(row.id, a, "Rescheduled", `From ${existing.startsAt.toISOString()} to ${row.startsAt.toISOString()}`);

  const ne = noticeEvent(row);
  const aud = { trainingOrganizationId: row.trainingOrganizationId, audience: row.audience, targets: row.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })) };
  if (row.status === "SCHEDULED") {
    if (rescheduled) await notifyAudienceAndRegistered({ ...ne, ...aud }, "RESCHEDULED", {}, `RESCHEDULED:${row.startsAt.getTime()}`);
    else if (wasStatus === "DRAFT" && row.audience !== "PUBLIC" && row.audience !== "ORG_STAFF") await notifyAudienceAndRegistered({ ...ne, ...aud }, "INVITED");
    else if (wasStatus === "DRAFT" && row.audience === "ORG_STAFF" && row.trainingOrganizationId === null) await notifyAudienceAndRegistered({ ...ne, ...aud }, "INVITED");
    else if (!rescheduled && existing && ["SELECTED_TRAINEES", "INVITED", "PRIVATE"].includes(row.audience)) await notifyAudienceAndRegistered({ ...ne, ...aud }, "INVITED"); // people added since are told once
  }
  if (promotion === "SUBMITTED" && existing?.promotionStatus !== "SUBMITTED") {
    await sendNotice(row.id, "PROMOTION_SUBMITTED", await promotionReviewers(), noticeFor("PROMOTION_SUBMITTED", ne, { who: row.trainingOrganization?.name, manageUrl: `/admin/events/promotions?focus=${row.id}` }), { dedupeKind: `PROMOTION_SUBMITTED:${(promoRequestedAt ?? new Date()).getTime()}` });
  }
  await audit(a, creating ? "EVENT_CREATED" : "EVENT_EDITED", row, null, { status: row.status, audience: row.audience, promotion: row.promotionStatus });
  return { event: toView(row, new Date(), { manager: true }), warnings: v.warnings, conflicts };
}

// ---------------------------------------------------------------------------------------------------------------- cancel, archive, delete

export async function cancelEvent(a: Actor, id: string, reason: string): Promise<EventView> {
  await assertEnabled(a);
  const { row } = await mustManage(a, id, "cancel");
  const why = reason.replace(/\s+/g, " ").trim().slice(0, 500);
  if (why.length < 3) throw new EventsError("Give a reason for cancelling.", 422, { reason: "Give a reason for cancelling." });
  const ok = canChangeStatus(row.status, "CANCELLED", phaseOf(row, new Date()));
  if (!ok.ok) throw new EventsError(ok.reason ?? "That event cannot be cancelled.", 409);
  const updated = await prisma.event.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: why, publishedAt: null }, select: ROW });
  await log(id, a, "Cancelled", why);
  await audit(a, "EVENT_CANCELLED", row, why);
  await notifyAudienceAndRegistered({ ...noticeEvent(updated), trainingOrganizationId: updated.trainingOrganizationId, audience: updated.audience, targets: updated.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })) }, "CANCELLED", { reason: why });
  return toView(updated, new Date(), { manager: true });
}

export async function archiveEvent(a: Actor, id: string): Promise<EventView> {
  await assertEnabled(a);
  const { row } = await mustManage(a, id, "cancel");
  const ok = canChangeStatus(row.status, "ARCHIVED", phaseOf(row, new Date()));
  if (!ok.ok) throw new EventsError(ok.reason ?? "That event cannot be archived.", 409);
  const updated = await prisma.event.update({ where: { id }, data: { status: "ARCHIVED", publishedAt: null }, select: ROW });
  await log(id, a, "Archived");
  await audit(a, "EVENT_ARCHIVED", row);
  return toView(updated, new Date(), { manager: true });
}

export async function deleteDraft(a: Actor, id: string): Promise<void> {
  await assertEnabled(a);
  const { row } = await mustManage(a, id, "cancel");
  if (row.status !== "DRAFT") throw new EventsError("Only a draft can be deleted. Cancel a scheduled event instead.", 409);
  await prisma.event.delete({ where: { id } });
  await audit(a, "EVENT_DELETED", row);
}

// ---------------------------------------------------------------------------------------------------------------- promotion and publishing

export interface PromotionInput { action: PromotionAction; reason?: string; publishAtLocal?: string | null }

/**
 * Moves a request through the public-promotion workflow. An organisation may only submit and withdraw its own request. Approving,
 * rejecting, asking for changes and publishing belong to AAICBI staff holding the matching permission. Nothing is public until published.
 */
export async function promotionAction(a: Actor, id: string, input: PromotionInput): Promise<EventView> {
  const settings = await assertEnabled(a);
  const row = await mustLoad(id);
  const rights = rightsOf(a, row);
  if (!rights.read) throw new EventsError("That event was not found.", 404);
  const reason = (input.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const now = new Date();
  const ne = noticeEvent(row);
  const aud = { trainingOrganizationId: row.trainingOrganizationId, audience: row.audience, targets: row.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })) };
  const orgRecipient: Recipient[] = row.trainingOrganizationId ? [{ recipientType: "TRAINING_ORG", recipientId: row.trainingOrganizationId }] : [];
  if (row.status !== "SCHEDULED" && input.action !== "withdraw") throw new EventsError("Only a scheduled event can be promoted. Schedule it first.", 409);
  if (phaseOf(row, now) === "COMPLETED") throw new EventsError("That event has already finished.", 409);

  // AAICBI's own events (and events AAICBI manages for an organisation) have no approval step: staff with the publish permission publish them.
  if (row.managedBy === "PLATFORM") {
    if (a.kind === "ORGANIZATION") throw new EventsError("AAICBI manages this event.", 403);
    if (input.action !== "publish" && input.action !== "unpublish") throw new EventsError("That action does not apply to an event AAICBI manages.", 400);
    await need(a, "events.platform:publish");
    if (row.audience !== "PUBLIC") throw new EventsError("Only an event with the Public audience can be published.", 409);
    if (input.action === "unpublish") {
      if (row.promotionStatus !== "PUBLISHED" && row.promotionStatus !== "APPROVED") throw new EventsError("It is not published.", 409);
      const u = await prisma.event.update({ where: { id }, data: { promotionStatus: "NONE", publishedAt: null, publishAt: null }, select: ROW });
      await log(id, a, "Taken off the public pages", reason || null); await audit(a, "EVENT_UNPUBLISHED", row, reason);
      return toView(u, now, { manager: true });
    }
    return publishNow(a, row, input.publishAtLocal, now, aud, ne, orgRecipient);
  }

  const mine = a.kind === "ORGANIZATION";
  if (mine && !ORG_PROMOTION_ACTIONS.includes(input.action)) throw new EventsError("Only AAICBI can approve, reject or publish.", 403);
  if (!mine && ORG_PROMOTION_ACTIONS.includes(input.action)) throw new EventsError("Only the organisation can submit or withdraw its own request.", 403);
  if (PROMOTION_ACTIONS_NEED_REASON.includes(input.action) && reason.length < 3) throw new EventsError("Give a reason so the organisation knows what to do next.", 422, { reason: "Give a reason." });

  if (mine) {
    if (input.action === "submit") {
      await need(a, "org_events.promotion:create");
      if (!settings.promotionsEnabled) throw new EventsError("Public promotion requests are switched off.", 403);
      if (row.audience !== "PUBLIC") throw new EventsError("Choose the Public audience before asking for promotion.", 409);
      if (!rightsOf(a, row).edit) throw new EventsError("You do not have permission to change this event.", 403);
    } else { await need(a, "org_events.promotion:view"); await need(a, "org_events.promotion:create"); }
  } else if (input.action === "publish" || input.action === "unpublish") await need(a, "events.promotions:publish");
  else await need(a, "events.promotions:approve");

  const next = nextPromotion(row.promotionStatus, input.action);
  if (!next.ok) throw new EventsError(next.reason, 409);

  if (input.action === "publish") return publishNow(a, row, input.publishAtLocal, now, aud, ne, orgRecipient);

  const data: Prisma.EventUpdateInput = { promotionStatus: next.to, promotionDecidedAt: mine ? null : now, promotionDecidedById: mine ? null : a.userId };
  if (input.action === "submit") { data.promotionRequestedAt = now; data.promotionNote = null; }
  if (input.action === "reject" || input.action === "request_changes") data.promotionNote = reason;
  if (input.action === "reject" || input.action === "request_changes" || input.action === "unpublish" || input.action === "withdraw") { data.publishedAt = null; data.publishAt = null; }
  if (input.action === "approve") data.promotionNote = reason || null;
  const u = await prisma.event.update({ where: { id }, data, select: ROW });
  const label: Record<PromotionAction, string> = { submit: "Submitted for public promotion", withdraw: "Promotion request withdrawn", approve: "Approved for promotion", reject: "Promotion rejected", request_changes: "Changes requested", publish: "Published", unpublish: "Taken off the public pages" };
  await log(id, a, label[input.action], reason || null);
  await audit(a, `EVENT_PROMOTION_${input.action.toUpperCase()}`, row, reason, { promotion: next.to });
  if (input.action === "submit") await sendNotice(id, "PROMOTION_SUBMITTED", await promotionReviewers(), noticeFor("PROMOTION_SUBMITTED", ne, { who: row.trainingOrganization?.name, manageUrl: `/admin/events/promotions?focus=${id}` }), { dedupeKind: `PROMOTION_SUBMITTED:${now.getTime()}` });
  const orgUrl = "/admin/organization/events";
  const toOrg = (k: Parameters<typeof noticeFor>[0], dedupe: string) => sendNotice(id, k, orgRecipient, noticeFor(k, ne, { reason, manageUrl: `${orgUrl}/${id}` }), { dedupeKind: `${dedupe}:${now.getTime()}` });
  if (input.action === "approve") await toOrg("PROMOTION_APPROVED", "PROMOTION_APPROVED");
  if (input.action === "reject") await toOrg("PROMOTION_REJECTED", "PROMOTION_REJECTED");
  if (input.action === "request_changes") await toOrg("PROMOTION_CHANGES", "PROMOTION_CHANGES");
  if (input.action === "unpublish") await toOrg("PROMOTION_PULLED", "PROMOTION_PULLED");
  return toView(u, now, { manager: true });
}

async function publishNow(a: Actor, row: Row, publishAtLocal: string | null | undefined, now: Date, aud: { trainingOrganizationId: string | null; audience: Audience; targets: { kind: never; refId: string }[] }, ne: NoticeEvent, orgRecipient: Recipient[]): Promise<EventView> {
  if (row.audience !== "PUBLIC") throw new EventsError("Only an event with the Public audience can be published.", 409);
  let at: Date | null = null;
  if (publishAtLocal) {
    const { zonedToUtc } = await import("@/lib/events/eventsCore");
    at = zonedToUtc(publishAtLocal, row.timeZone);
    if (!at) throw new EventsError("That publication time is not valid.", 422, { publishAtLocal: "Choose a valid date and time." });
    if (at.getTime() >= row.endsAt.getTime()) throw new EventsError("Publish before the event ends.", 422, { publishAtLocal: "Choose a time before the event ends." });
  }
  const later = !!at && at.getTime() > now.getTime();
  const u = await prisma.event.update({
    where: { id: row.id },
    data: later ? { promotionStatus: "APPROVED", publishAt: at, publishedAt: null, promotionDecidedById: a.userId, promotionDecidedAt: now } : { promotionStatus: "PUBLISHED", publishedAt: now, publishAt: null, promotionDecidedById: a.userId, promotionDecidedAt: now },
    select: ROW,
  });
  await log(row.id, a, later ? "Scheduled for publication" : "Published", later ? at?.toISOString() : null);
  await audit(a, later ? "EVENT_PUBLISH_SCHEDULED" : "EVENT_PUBLISHED", row);
  if (!later) await announcePublished(u, orgRecipient.length > 0 && a.kind !== "ORGANIZATION");
  return toView(u, now, { manager: true });
}

/** Tells the audience a public event is live, and the organisation that it was published. Safe to call twice. */
async function announcePublished(row: Row, tellOrg: boolean) {
  const ne = noticeEvent(row);
  await notifyAudienceAndRegistered({ ...ne, trainingOrganizationId: row.trainingOrganizationId, audience: row.audience, targets: row.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })) }, "PUBLISHED");
  if (tellOrg && row.trainingOrganizationId) await sendNotice(row.id, "PROMOTION_PUBLISHED", [{ recipientType: "TRAINING_ORG", recipientId: row.trainingOrganizationId }], noticeFor("PROMOTION_PUBLISHED", ne));
}

/** Publishes approved events whose "publish at" time has come, and tells people. Run by the hourly job; safe to run twice. */
export async function sweepScheduledPublications(now: Date = new Date()): Promise<number> {
  const due = await prisma.event.findMany({ where: { status: "SCHEDULED", audience: "PUBLIC", promotionStatus: "APPROVED", publishAt: { lte: now }, endsAt: { gt: now } }, select: ROW, take: 100 });
  for (const r of due) {
    const u = await prisma.event.update({ where: { id: r.id }, data: { promotionStatus: "PUBLISHED", publishedAt: now, publishAt: null }, select: ROW });
    await log(r.id, null, "Published", "At the scheduled time");
    await announcePublished(u, true);
  }
  return due.length;
}

// ---------------------------------------------------------------------------------------------------------------- categories and settings

export async function listCategories(activeOnly = true) {
  return prisma.eventCategory.findMany({ where: activeOnly ? { active: true } : {}, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, active: true, sortOrder: true } });
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
export async function saveCategory(a: Actor, input: { id?: string; name?: unknown; active?: unknown; sortOrder?: unknown }) {
  await need(a, "events.categories:manage");
  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (input.id && input.name === undefined) {
    const u = await prisma.eventCategory.update({ where: { id: input.id }, data: { active: input.active === true } });
    await recordAudit({ actorId: a.userId, actorRole: a.session.role, action: "EVENT_CATEGORY_CHANGED", resourceType: "event_category", resourceId: u.id });
    return u;
  }
  if (name.length < 2) throw new EventsError("Give the category a name.", 422, { name: "Give the category a name." });
  const sortOrder = Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0;
  try {
    const u = input.id
      ? await prisma.eventCategory.update({ where: { id: input.id }, data: { name, active: input.active !== false, sortOrder } })
      : await prisma.eventCategory.create({ data: { name, slug: slugify(name) || `category-${Date.now()}`, active: input.active !== false, sortOrder } });
    await recordAudit({ actorId: a.userId, actorRole: a.session.role, action: "EVENT_CATEGORY_CHANGED", resourceType: "event_category", resourceId: u.id });
    return u;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new EventsError("A category with that name already exists.", 409, { name: "That name is already used." });
    throw e;
  }
}

export async function updateSettings(a: Actor, patch: Record<string, unknown>) {
  await need(a, "events.settings:configure");
  const data: Record<string, unknown> = {};
  for (const k of ["enabled", "orgEventsEnabled", "promotionsEnabled", "registrationEnabled", "showPast"]) if (typeof patch[k] === "boolean") data[k] = patch[k];
  if (patch.joinOpensMinutes !== undefined) {
    const n = Number(patch.joinOpensMinutes);
    if (!Number.isInteger(n) || n < 0 || n > 1440) throw new EventsError("Choose from 0 to 1440 minutes.", 422, { joinOpensMinutes: "Choose from 0 to 1440 minutes." });
    data.joinOpensMinutes = n;
  }
  await prisma.eventSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data, updatedById: a.userId }, update: { ...data, updatedById: a.userId } });
  await recordAudit({ actorId: a.userId, actorRole: a.session.role, action: "EVENT_SETTINGS_CHANGED", resourceType: "event_settings", resourceId: "default", after: data });
  return getEventSettings();
}

// ---------------------------------------------------------------------------------------------------------------- overview numbers

export interface OverviewNumbers { upcoming: number; live: number; drafts: number; pendingPromotion: number; published: number; registrations: number; completed30: number }
export async function overview(a: Actor): Promise<OverviewNumbers> {
  const now = new Date();
  const scope: Prisma.EventWhereInput = a.kind === "ORGANIZATION" ? { trainingOrganizationId: a.orgId ?? "none" } : a.permissions.has("events.global:view") ? {} : { managedBy: "PLATFORM" };
  const [upcoming, live, drafts, pendingPromotion, published, registrations, completed30] = await Promise.all([
    prisma.event.count({ where: { ...scope, status: "SCHEDULED", startsAt: { gt: now } } }),
    prisma.event.count({ where: { ...scope, status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now } } }),
    prisma.event.count({ where: { ...scope, status: "DRAFT" } }),
    a.kind === "ORGANIZATION" ? prisma.event.count({ where: { ...scope, promotionStatus: { in: ["SUBMITTED", "CHANGES_REQUESTED"] } } }) : prisma.event.count({ where: { promotionStatus: "SUBMITTED", status: "SCHEDULED" } }),
    prisma.event.count({ where: { ...scope, ...publicWhere(now), endsAt: { gt: now } } }),
    prisma.eventRegistration.count({ where: { status: "CONFIRMED", event: { ...scope, endsAt: { gt: now } } } }),
    prisma.event.count({ where: { ...scope, status: "SCHEDULED", endsAt: { lte: now, gt: new Date(now.getTime() - 30 * DAY_MS) } } }),
  ]);
  return { upcoming, live, drafts, pendingPromotion, published, registrations, completed30 };
}

export { ANON };
export type { Viewer };
export { profileOf };

/** Organisations that have a published public event coming up, for the "organiser" filter on the events page. */
export async function publicOrganizers(): Promise<{ id: string; name: string }[]> {
  const now = new Date();
  const rows = await prisma.event.findMany({ where: { AND: [publicWhere(now), { endsAt: { gt: now } }, { trainingOrganizationId: { not: null } }] }, select: { trainingOrganization: { select: { id: true, name: true } } }, distinct: ["trainingOrganizationId"], take: 100 });
  return rows.map((r) => r.trainingOrganization).filter((o): o is { id: string; name: string } => !!o).sort((a, b) => a.name.localeCompare(b.name));
}
