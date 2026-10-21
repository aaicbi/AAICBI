import { prisma } from "@/lib/prisma";
import { getSession, requireRole, type SessionPayload } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { resolveOrgActor } from "@/lib/org/actor";
import { accessOf, PermissionError } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { ensureProfile } from "@/lib/profiles/profiles";
import { ANON, type Viewer } from "@/lib/events/eventsCore";

/**
 * Who is acting on the Event Manager, and who is looking at an event. Everything is read from the database on every call (a revoked
 * permission or an ended enrolment takes effect on the next request). The client is never trusted for who someone is or what they may see.
 */
export class EventsError extends Error {
  constructor(message: string, public status = 400, public fields?: Record<string, string>) { super(message); }
}

export interface EventSettingsView { enabled: boolean; orgEventsEnabled: boolean; promotionsEnabled: boolean; registrationEnabled: boolean; showPast: boolean; joinOpensMinutes: number }
const DEFAULT_SETTINGS: EventSettingsView = { enabled: true, orgEventsEnabled: true, promotionsEnabled: true, registrationEnabled: true, showPast: true, joinOpensMinutes: 15 };

export async function getEventSettings(): Promise<EventSettingsView> {
  try {
    const row = await prisma.eventSettings.findUnique({ where: { id: "default" } });
    return row ? { enabled: row.enabled, orgEventsEnabled: row.orgEventsEnabled, promotionsEnabled: row.promotionsEnabled, registrationEnabled: row.registrationEnabled, showPast: row.showPast, joinOpensMinutes: row.joinOpensMinutes } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

/** A person managing events: AAICBI staff (Super Admin or staff holding permissions) or a member of a training organization. */
export interface Actor {
  kind: "SUPER_ADMIN" | "STAFF" | "ORGANIZATION";
  userId: string;
  label: string;
  orgId: string | null;
  orgName: string | null;
  permissions: Set<string>;
  session: SessionPayload;
}

/** The signed-in manager, or null when the person is not staff or an organization member (or holds no event permission at all). */
export async function actorOf(input: SessionPayload | null): Promise<Actor | null> {
  if (!input) return null;
  let session = input;
  // A page reads the session without the organization person attached; work out who they are so an owner is not treated as a viewer.
  if (session.role === "ADMIN" && !session.actor) {
    const org = await findTrainingOrgByStaffUserId(session.userId);
    if (org) session = { ...session, actor: await resolveOrgActor(org, session.email).catch(() => undefined) };
  }
  const a = await accessOf(session);
  if (a.kind === "none") return null;
  if (a.kind === "organization") {
    const label = session.actor?.name ? `${session.actor.name} (${a.organizationName})` : (a.organizationName ?? "Organization");
    return { kind: "ORGANIZATION", userId: session.userId, label, orgId: a.organizationId, orgName: a.organizationName, permissions: a.permissions, session };
  }
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  return { kind: a.kind === "super" ? "SUPER_ADMIN" : "STAFF", userId: session.userId, label: u?.name ?? "AAICBI staff", orgId: null, orgName: null, permissions: a.permissions, session };
}

/** For API routes: goes through requireRole, so organization roles and the platform-fee pause apply first. */
export async function requireActor(): Promise<Actor> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  const actor = await actorOf(session);
  if (!actor) throw new EventsError("You do not have access to the Event Manager.", 403);
  return actor;
}

export const isPlatform = (a: Actor) => a.kind !== "ORGANIZATION";
export const can = (a: Actor, permission: string) => a.permissions.has(permission);

/** Throws a 403 (and records the denied attempt) unless the actor holds the permission. */
export async function need(a: Actor, permission: string): Promise<void> {
  if (a.permissions.has(permission)) return;
  await recordAudit({ actorId: a.userId, actorRole: a.kind === "ORGANIZATION" ? "ORGANIZATION" : a.session.role, action: "ACCESS_DENIED", resourceType: "permission", resourceId: permission, organizationId: a.orgId, outcome: "DENIED" });
  throw new PermissionError(permission);
}

/** Does the actor hold any permission that opens the Event Manager? Used by menus and cards. */
export function opensManager(permissions: ReadonlySet<string>, kind: "platform" | "organization"): boolean {
  const prefix = kind === "platform" ? "events." : "org_events.";
  return [...permissions].some((k) => k.startsWith(prefix));
}

export async function assertEnabled(a: Actor | null): Promise<EventSettingsView> {
  const s = await getEventSettings();
  if (!s.enabled) throw new EventsError("The Event Manager is switched off.", 403);
  if (a?.kind === "ORGANIZATION" && !s.orgEventsEnabled) throw new EventsError("Events for organizations are switched off.", 403);
  return s;
}

/** The profile of whoever is signed in (created on first use), for registrations. */
export async function profileOf(session: SessionPayload): Promise<{ id: string } | null> {
  const kind = session.role === "TRAINEE" ? "PERSON" : session.role === "EMPLOYER" ? "EMPLOYER" : session.role === "INVESTOR" ? "INVESTOR" : null;
  if (kind) return ensureProfile(kind, session.userId);
  const a = await accessOf(session);
  if (a.kind === "organization" && a.organizationId) return ensureProfile("TRAINING_ORG", a.organizationId);
  if (a.kind === "super" || a.kind === "staff") return ensureProfile("STAFF", session.userId);
  return null;
}

/** Everything about the person that decides which events they may see. */
export async function loadViewer(session: SessionPayload | null): Promise<Viewer> {
  if (!session) return ANON;
  const profile = await profileOf(session).catch(() => null);
  const base: Viewer = { ...ANON, signedIn: true, profileId: profile?.id ?? null };
  if (session.role === "TRAINEE") {
    const [enr, cohorts] = await Promise.all([
      prisma.courseEnrollment.findMany({ where: { traineeId: session.userId, accessRevokedAt: null }, select: { courseId: true, course: { select: { createdById: true } } } }),
      prisma.enrollmentRecord.findMany({ where: { traineeId: session.userId }, select: { cohortId: true } }),
    ]);
    const owners = [...new Set(enr.map((e) => e.course.createdById).filter((x): x is string => !!x))];
    const orgs = owners.length ? await prisma.trainingOrganization.findMany({ where: { staffUserId: { in: owners } }, select: { id: true } }) : [];
    return { ...base, traineeId: session.userId, courseIds: enr.map((e) => e.courseId), cohortIds: cohorts.map((c) => c.cohortId), memberOrgIds: orgs.map((o) => o.id) };
  }
  if (session.role === "EMPLOYER" || session.role === "INVESTOR") return base;
  const a = await accessOf(session);
  if (a.kind === "organization") return { ...base, staffOrgId: a.organizationId };
  if (a.kind === "super" || a.kind === "staff") return { ...base, seesAll: a.kind === "super" || a.permissions.has("events.global:view") };
  return base;
}

export async function currentViewer(): Promise<{ session: SessionPayload | null; viewer: Viewer }> {
  const session = await getSession();
  return { session, viewer: await loadViewer(session) };
}
