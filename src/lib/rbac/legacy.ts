import { cleanKeys, STAFF_PERMISSIONS } from "@/lib/rbac/catalogue";

/**
 * What each staff role could already do before permissions existed, expressed as permissions. A staff account with no role template and no
 * overrides (every account that exists today) resolves to exactly this, so shipping the permission system changes nobody's access.
 *
 * Two deliberate exceptions, both agreed: nobody but a Super Admin has any `gaming_studio.*` permission until it is granted, and the old
 * "share game results with staff" switch is replaced by `gaming_ops.results:view` which is not in these sets.
 *
 * This map is checked against the route gates category by category as each category moves to `requirePermission` (docs/rbac-audit-and-plan.md).
 */
const INSTRUCTOR = [
  "courses.content:create", "courses.content:edit", "courses.content:delete", "courses.content:publish", "courses.resources:manage", "courses.submissions:view",
  "courses.submissions:approve", "courses.cohorts:manage", "courses.completion:view",
  "trainees.profiles:view", "trainees.assessments:view", "trainees.performance:view",
  "chat.rooms:view", "chat.messages:moderate", "chat.reports:view", "chat.reports:moderate", "chat.participants:manage", "chat.games:manage", "chat.incidents:view",
  "comms.messages:view", "reports.dashboards:view", "reports.trainees:view", "billing.payments:view",
  "feed.posts:view",
];

const ADMIN = [
  ...INSTRUCTOR,
  "trainees.profiles:edit", "trainees.register:create", "trainees.enrolments:manage", "trainees.cohorts:manage", "trainees.restrictions:manage",
  "orgs.records:view", "orgs.records:edit", "orgs.approvals:approve", "orgs.settings:manage", "orgs.analytics:view", "orgs.members:manage",
  "partners.employers:view", "partners.employers:approve", "partners.employers:moderate", "partners.jobs:approve", "partners.jobs:moderate",
  "partners.investors:view", "partners.investors:moderate", "partners.startups:view", "partners.startups:moderate", "partners.listings:moderate",
  "feed.posts:approve", "feed.posts:moderate", "feed.comments:moderate", "feed.reports:moderate",
  "comms.notifications:manage", "comms.announcements:create",
  "reports.organizations:view", "reports.platform:view", "reports.gaming:view", "billing.transactions:view",
];

export const LEGACY_DEFAULTS: Record<"SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR", string[]> = {
  SUPER_ADMIN: STAFF_PERMISSIONS,
  ADMIN: cleanKeys(ADMIN),
  INSTRUCTOR: cleanKeys(INSTRUCTOR),
};

export function legacyDefaults(role: string): string[] {
  return role === "SUPER_ADMIN" ? [...LEGACY_DEFAULTS.SUPER_ADMIN] : role === "ADMIN" ? [...LEGACY_DEFAULTS.ADMIN] : role === "INSTRUCTOR" ? [...LEGACY_DEFAULTS.INSTRUCTOR] : [];
}
