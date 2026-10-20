import { HIGH_RISK, STAFF_PERMISSIONS, cleanKeys, isHighRisk } from "@/lib/rbac/catalogue";

/**
 * Who may change whose permissions, and by how much. Pure, so the escalation rules are tested.
 *  - A Super Admin may set any staff permission on any admin or instructor.
 *  - Anyone else needs `staff.permissions:assign_permissions`, and may only add or remove permissions they hold themselves, never a high-risk one.
 *  - Nobody changes their own permissions, and nobody (other than a database administrator) changes a Super Admin.
 */
export interface Actor { id: string; role: string; permissions: Set<string> }
export interface Target { id: string; role: string }

export type Verdict = { ok: true } | { ok: false; reason: string; denied?: string[] };

export function diffKeys(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const b = new Set(before), a = new Set(after);
  return { added: after.filter((k) => !b.has(k)), removed: before.filter((k) => !a.has(k)) };
}

export function mayChange(actor: Actor, target: Target, before: string[], after: string[]): Verdict {
  if (actor.id === target.id) return { ok: false, reason: "You cannot change your own permissions." };
  if (target.role === "SUPER_ADMIN") return { ok: false, reason: "A Super Admin account cannot be changed here." };
  if (target.role !== "ADMIN" && target.role !== "INSTRUCTOR") return { ok: false, reason: "Only admin and instructor accounts have staff permissions." };
  const clean = cleanKeys(after);
  const { added, removed } = diffKeys(cleanKeys(before), clean);
  if (actor.role === "SUPER_ADMIN") return { ok: true };
  if (!actor.permissions.has("staff.permissions:assign_permissions")) return { ok: false, reason: "You are not allowed to assign permissions." };
  const beyond = [...added, ...removed].filter((k) => !actor.permissions.has(k) || isHighRisk(k));
  if (beyond.length) return { ok: false, reason: "You can only change permissions you hold yourself, and never a high-risk one.", denied: beyond };
  return { ok: true };
}

/** The permissions of the form's "select everything in a category": never silently includes a high-risk one. */
export function bulkSelectable(keys: string[], actor: Actor): string[] {
  return keys.filter((k) => STAFF_PERMISSIONS.includes(k) && (actor.role === "SUPER_ADMIN" ? !HIGH_RISK.includes(k) : actor.permissions.has(k) && !HIGH_RISK.includes(k)));
}
