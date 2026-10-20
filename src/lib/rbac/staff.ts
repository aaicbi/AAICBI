import { prisma } from "@/lib/prisma";
import { cleanKeys, isHighRisk } from "@/lib/rbac/catalogue";
import { templateOf } from "@/lib/rbac/templates";
import { resolveStaff } from "@/lib/rbac/resolve";
import { diffKeys, mayChange, type Actor } from "@/lib/rbac/authority";
import { customRolePermissions } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";

export const CUSTOM_KEY = "custom";

export class StaffAccessError extends Error {
  constructor(message: string, public status = 400, public denied?: string[]) { super(message); }
}

export interface AccessInput { staffRoleKey: string | null; grants: string[]; denies: string[] }

/** The role key must be a built-in template, "custom" (start empty), or a saved custom role. */
export async function checkRoleKey(key: string | null): Promise<void> {
  if (key === null || key === CUSTOM_KEY || templateOf(key)) return;
  if (!(await prisma.staffRole.findUnique({ where: { key }, select: { id: true } }))) throw new StaffAccessError("That role does not exist.", 400);
}

async function effective(role: string, active: boolean, a: AccessInput): Promise<string[]> {
  return [...resolveStaff({ role, active, staffRoleKey: a.staffRoleKey, grants: a.grants, denies: a.denies }, await customRolePermissions(a.staffRoleKey))];
}

/**
 * Saves who a staff member is allowed to be: their role template and the permissions added to or taken from it. Refused for yourself, for a
 * Super Admin, and beyond the actor's own authority. Recorded with the before and after. Takes effect on the person's very next request.
 */
export async function saveStaffAccess(actor: Actor, targetId: string, input: AccessInput): Promise<{ effective: string[] }> {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, active: true, staffRoleKey: true, permissionGrants: true, permissionDenies: true } });
  if (!target) throw new StaffAccessError("Staff member not found.", 404);
  await checkRoleKey(input.staffRoleKey);
  const next: AccessInput = { staffRoleKey: input.staffRoleKey, grants: cleanKeys(input.grants), denies: cleanKeys(input.denies) };
  const before = await effective(target.role, target.active, { staffRoleKey: target.staffRoleKey, grants: target.permissionGrants, denies: target.permissionDenies });
  const after = await effective(target.role, target.active, next);
  const verdict = mayChange(actor, { id: target.id, role: target.role }, before, after);
  if (!verdict.ok) {
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "PERMISSIONS_REFUSED", resourceType: "staff", resourceId: target.id, outcome: "DENIED", reason: verdict.reason });
    throw new StaffAccessError(verdict.reason, 403, verdict.denied);
  }
  await prisma.user.update({ where: { id: target.id }, data: { staffRoleKey: next.staffRoleKey, permissionGrants: next.grants, permissionDenies: next.denies } });
  const { added, removed } = diffKeys(before, after);
  await recordAudit({
    actorId: actor.id, actorRole: actor.role, action: "PERMISSIONS_CHANGED", resourceType: "staff", resourceId: target.id,
    before: { role: target.staffRoleKey, grants: target.permissionGrants, denies: target.permissionDenies },
    after: { role: next.staffRoleKey, grants: next.grants, denies: next.denies, added, removed, highRiskAdded: added.filter(isHighRisk) },
  });
  if (added.some((k) => k.startsWith("gaming_studio.access"))) await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "STUDIO_ACCESS_GRANTED", resourceType: "staff", resourceId: target.id });
  if (removed.some((k) => k.startsWith("gaming_studio.access"))) await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "STUDIO_ACCESS_REVOKED", resourceType: "staff", resourceId: target.id });
  return { effective: after };
}

export async function staffDetail(id: string) {
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true, canReview: true, jobTitle: true, staffNumber: true, staffRoleKey: true, permissionGrants: true, permissionDenies: true, createdAt: true },
  });
  if (!u) return null;
  const eff = await effective(u.role, u.active, { staffRoleKey: u.staffRoleKey, grants: u.permissionGrants, denies: u.permissionDenies });
  const history = await prisma.auditEvent.findMany({
    where: { resourceType: "staff", resourceId: id, action: { in: ["PERMISSIONS_CHANGED", "PERMISSIONS_REFUSED", "STAFF_CREATED", "STAFF_SUSPENDED", "STAFF_REACTIVATED", "STUDIO_ACCESS_GRANTED", "STUDIO_ACCESS_REVOKED"] } },
    orderBy: { createdAt: "desc" }, take: 30,
    select: { id: true, action: true, actorId: true, outcome: true, reason: true, after: true, createdAt: true },
  });
  const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(history.map((h) => h.actorId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return {
    ...u, createdAt: u.createdAt.toISOString(), untouched: !u.staffRoleKey && u.permissionGrants.length === 0 && u.permissionDenies.length === 0, effective: eff,
    history: history.map((h) => ({ id: h.id, action: h.action, by: h.actorId ? names.get(h.actorId) ?? "Someone" : "The system", outcome: h.outcome, reason: h.reason, at: h.createdAt.toISOString(), added: ((h.after as { added?: string[] } | null)?.added ?? []).length, removed: ((h.after as { removed?: string[] } | null)?.removed ?? []).length })),
  };
}
