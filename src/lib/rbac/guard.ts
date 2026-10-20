import { prisma } from "@/lib/prisma";
import { requireRole, type SessionPayload } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { isPermissionKey } from "@/lib/rbac/catalogue";
import { templateOf } from "@/lib/rbac/templates";
import { DEFAULT_ORG_POLICY, resolveOrganization, resolveStaff, type OrgGamingPolicyInput, type OrgRoleName } from "@/lib/rbac/resolve";
import { recordAudit } from "@/lib/rbac/audit";

/**
 * Server-side enforcement of permissions. Built on the existing session and `requireRole`, so sign-in, organization teammate rules and
 * the platform-fee pause all still apply first. Permissions are read from the database on every call: removing one takes effect for an
 * open session on its very next request. The client is never trusted for who someone is, which organization they belong to, or what they may do.
 */
export type AccessKind = "super" | "staff" | "organization" | "none";

export interface Access {
  kind: AccessKind;
  permissions: Set<string>;
  /** For an organization session: the organization, taken from the session, never from the request. */
  organizationId: string | null;
  organizationName: string | null;
  organizationUserId: string | null;
}

const NONE: Access = { kind: "none", permissions: new Set(), organizationId: null, organizationName: null, organizationUserId: null };

export async function customRolePermissions(key: string | null | undefined): Promise<Record<string, string[]>> {
  if (!key || templateOf(key)) return {};
  const row = await prisma.staffRole.findUnique({ where: { key }, select: { permissions: true } });
  return row ? { [key]: row.permissions } : {};
}

/** What a staff user (by id) may do, read fresh from the database. Used by the guard, the menus and the staff screens. */
export async function staffPermissionsOf(userId: string): Promise<Set<string>> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true, staffRoleKey: true, permissionGrants: true, permissionDenies: true } });
  if (!u) return new Set();
  return resolveStaff({ role: u.role, active: u.active, staffRoleKey: u.staffRoleKey, grants: u.permissionGrants, denies: u.permissionDenies }, await customRolePermissions(u.staffRoleKey));
}

export async function orgPolicyOf(organizationId: string): Promise<OrgGamingPolicyInput> {
  const row = await prisma.orgGamingPolicy.findUnique({ where: { organizationId } });
  return row ? { resultsView: row.resultsView, resultsExport: row.resultsExport, liveMonitor: row.liveMonitor, endSessions: row.endSessions, restrictTrainees: row.restrictTrainees, removeParticipants: row.removeParticipants, chatGameModeration: row.chatGameModeration, toggleGames: row.toggleGames, courseRules: row.courseRules } : { ...DEFAULT_ORG_POLICY };
}

/** Works out what the signed-in person may do. An organization session is told apart from a real staff admin by the account that owns it. */
export async function accessOf(session: SessionPayload): Promise<Access> {
  if (session.role === "SUPER_ADMIN") return { ...NONE, kind: "super", permissions: await staffPermissionsOf(session.userId) };
  if (session.role !== "ADMIN" && session.role !== "INSTRUCTOR") return NONE;
  const org = session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId) : null;
  if (org) {
    const role = (session.actor?.role ?? "VIEWER") as OrgRoleName;
    return { kind: "organization", permissions: resolveOrganization(role, await orgPolicyOf(org.id)), organizationId: org.id, organizationName: org.name, organizationUserId: org.staffUserId };
  }
  return { ...NONE, kind: "staff", permissions: await staffPermissionsOf(session.userId) };
}

export class PermissionError extends Error {
  status = 403;
  constructor(public permission: string) {
    super("You do not have permission to do this.");
  }
}

/**
 * Throws 401 when not signed in and 403 when the person lacks the permission (recorded as a denied attempt). Returns who they are and, for an
 * organization, which organization: use that, not anything the request says.
 */
export async function requirePermission(permission: string): Promise<{ session: SessionPayload; access: Access }> {
  if (!isPermissionKey(permission)) throw new Error(`Unknown permission: ${permission}`);
  const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  const access = await accessOf(session);
  if (!access.permissions.has(permission)) {
    await recordAudit({ actorId: session.userId, actorRole: access.kind === "organization" ? "ORGANIZATION" : session.role, action: "ACCESS_DENIED", resourceType: "permission", resourceId: permission, organizationId: access.organizationId, outcome: "DENIED" });
    throw new PermissionError(permission);
  }
  return { session, access };
}

/** True when the signed-in person holds the permission. For menus and cards; the server still checks again on every action. */
export async function hasPermission(session: SessionPayload | null, permission: string): Promise<boolean> {
  if (!session) return false;
  return (await accessOf(session)).permissions.has(permission);
}
