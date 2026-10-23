import { ORG_PERMISSIONS, STAFF_PERMISSIONS, applyGates, cleanKeys } from "@/lib/rbac/catalogue";
import { legacyDefaults } from "@/lib/rbac/legacy";
import { templateOf } from "@/lib/rbac/templates";

/**
 * How the permissions of a person are worked out. Pure (no database, no session), so every rule here is tested.
 *
 * Deny by default: anything not clearly granted is refused. An unknown role key, an unknown permission key, a switched-off account or a
 * role that is not staff all resolve to nothing, never to something.
 */
export interface StaffInput {
  role: string;
  active: boolean;
  staffRoleKey: string | null;
  grants: string[];
  denies: string[];
}

/**
 * - Super Admin: every staff permission, always. Overrides cannot take anything away, so a Super Admin cannot be locked out.
 * - Staff (admin, instructor) with no role key and no overrides: exactly what their role always allowed (legacy defaults).
 * - Staff otherwise: the role (a built-in template, or a custom role) plus explicit grants, minus explicit denies, then the gates are applied
 *   (no Gaming Studio permission counts without access to the Gaming Studio).
 */
export function resolveStaff(input: StaffInput, customRoles: Record<string, string[]> = {}): Set<string> {
  if (input.role === "SUPER_ADMIN") return new Set(STAFF_PERMISSIONS);
  if (!input.active || (input.role !== "ADMIN" && input.role !== "INSTRUCTOR")) return new Set();
  const untouched = !input.staffRoleKey && input.grants.length === 0 && input.denies.length === 0;
  const base = new Set(untouched ? legacyDefaults(input.role) : input.staffRoleKey ? cleanKeys(templateOf(input.staffRoleKey)?.permissions ?? customRoles[input.staffRoleKey] ?? []) : legacyDefaults(input.role));
  for (const k of cleanKeys(input.grants)) base.add(k);
  for (const k of cleanKeys(input.denies)) base.delete(k);
  return applyGates(base);
}

/** What a training organization may do with its trainees' games: set per organization by a Super Admin. These defaults are what organizations could already do. */
export interface OrgGamingPolicyInput {
  resultsView: boolean; resultsExport: boolean; liveMonitor: boolean; endSessions: boolean; restrictTrainees: boolean;
  removeParticipants: boolean; chatGameModeration: boolean; toggleGames: boolean; courseRules: boolean;
}
export const DEFAULT_ORG_POLICY: OrgGamingPolicyInput = {
  resultsView: true, resultsExport: false, liveMonitor: true, endSessions: true, restrictTrainees: true, removeParticipants: true,
  chatGameModeration: true, toggleGames: false, courseRules: true,
};
export type OrgRoleName = "OWNER" | "MANAGER" | "EDITOR" | "VIEWER";

/**
 * The organization-games permissions of one person in an organization. Owners and managers may moderate; editors and viewers may only
 * look. Nothing outside the `org_games` category is ever returned: no Gaming Studio, no platform control.
 */
export function resolveOrganization(role: OrgRoleName, policy: OrgGamingPolicyInput = DEFAULT_ORG_POLICY, crmEnabled = false): Set<string> {
  const out = new Set<string>();
  const mod = role === "OWNER" || role === "MANAGER";
  if (policy.resultsView) out.add("org_games.results:view");
  if (policy.resultsView && policy.resultsExport && mod) out.add("org_games.results:export");
  if (policy.liveMonitor) out.add("org_games.live:view");
  if (policy.resultsView || policy.liveMonitor) out.add("org_games.reports:view");
  if (mod && policy.endSessions) out.add("org_games.sessions:moderate");
  if (mod && (policy.restrictTrainees || policy.removeParticipants)) out.add("org_games.restrictions:manage");
  if (mod && policy.chatGameModeration) out.add("org_games.chat_games:moderate");
  if (mod && (policy.endSessions || policy.restrictTrainees || policy.removeParticipants || policy.chatGameModeration)) out.add("org_games.reports:moderate");
  if (mod && (policy.toggleGames || policy.courseRules)) out.add("org_games.settings:configure");
  for (const k of orgEventPermissions(role)) out.add(k);
  for (const k of orgCrmPermissions(role, crmEnabled)) out.add(k);
  return new Set([...out].filter((k) => ORG_PERMISSIONS.includes(k)));
}

/**
 * What a person in an organization may do with the organization's own events. Owners and managers do everything; editors prepare events
 * and their pictures but do not handle registrations or send requests for public promotion; viewers only look. Whether the Event Manager
 * is switched on for organizations at all is a platform setting checked separately.
 */
export function orgEventPermissions(role: OrgRoleName): string[] {
  const view = ["org_events.events:view", "org_events.promotion:view"];
  if (role === "OWNER" || role === "MANAGER") {
    return [...view, "org_events.events:create", "org_events.events:edit", "org_events.media:manage", "org_events.registrations:view", "org_events.registrations:manage", "org_events.registrations:export", "org_events.promotion:create"];
  }
  if (role === "EDITOR") return [...view, "org_events.events:create", "org_events.events:edit", "org_events.media:manage", "org_events.registrations:view"];
  return view;
}

/**
 * What a person in an organization may do with its registrations (the CRM). Nothing at all unless a Super Admin switched the CRM on for the
 * organization. Owners and managers do everything; editors see and work registrations but cannot export; viewers see nothing, because the
 * records hold personal details.
 */
export function orgCrmPermissions(role: OrgRoleName, crmEnabled: boolean): string[] {
  if (!crmEnabled) return [];
  if (role === "OWNER" || role === "MANAGER") return ["org_crm.registrations:view", "org_crm.registrations:manage", "org_crm.registrations:export", "org_crm.contacts:view"];
  if (role === "EDITOR") return ["org_crm.registrations:view", "org_crm.registrations:manage", "org_crm.contacts:view"];
  return [];
}
