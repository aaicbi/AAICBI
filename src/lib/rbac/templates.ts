import { HIGH_RISK, PERMISSIONS, STAFF_PERMISSIONS, cleanKeys } from "@/lib/rbac/catalogue";

/**
 * The suggested role templates. A template is only a starting point: the Super Admin can add or remove any single permission before
 * saving, and choosing a template grants nothing until it is saved on a person. Pure data.
 */
export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

const all = (prefix: string, except: string[] = []) => PERMISSIONS.filter((p) => p.audience === "staff" && p.key.startsWith(prefix) && !except.includes(p.key)).map((p) => p.key);

const T = (key: string, name: string, description: string, permissions: string[]): RoleTemplate => ({ key, name, description, permissions: cleanKeys(permissions) });

export const ROLE_TEMPLATES: RoleTemplate[] = [
  T("platform_admin", "Platform Administrator", "Runs day-to-day operations across the platform. No staff or permission management, no Gaming Studio, none of the high-risk permissions.",
    STAFF_PERMISSIONS.filter((k) => !HIGH_RISK.includes(k) && !k.startsWith("staff.") && !k.startsWith("gaming_studio.") && !k.startsWith("events.")).concat(["staff.accounts:view", "staff.activity:view"])),
  T("gaming_studio_admin", "Gaming Studio Administrator", "Designs, tests and publishes games in the Gaming Studio, and sees game analytics. Does not moderate players.",
    [...all("gaming_studio."), "gaming_ops.results:view", "reports.gaming:view"]),
  T("gaming_ops_moderator", "Gaming Operations Moderator", "Watches and moderates games and game chat. Does not open the Gaming Studio.",
    ["gaming_ops.results:view", "gaming_ops.live:view", "gaming_ops.sessions:moderate", "gaming_ops.reports:view", "gaming_ops.reports:moderate", "gaming_ops.restrictions:manage",
      "gaming_ops.chat_games:moderate", "gaming_ops.incidents:view", "gaming_ops.incidents:manage", "chat.rooms:view", "chat.messages:moderate", "chat.reports:view",
      "chat.reports:moderate", "chat.games:manage", "chat.incidents:view", "reports.gaming:view"]),
  T("events_manager", "Events Manager", "Runs the platform Event Manager: creates and publishes AAICBI events, reviews organizations' promotion requests and keeps registrations. Cannot change event settings or export attendee lists unless added.",
    ["events.global:view", "events.platform:create", "events.platform:edit", "events.platform:publish", "events.platform:delete", "events.categories:manage", "events.promotions:view", "events.promotions:approve",
      "events.promotions:publish", "events.registrations:view", "events.registrations:manage", "events.analytics:view"]),
  T("crm_officer", "CRM and Admissions Officer", "Follows up course registrations: sees registrations and contacts, changes stages, sets follow-up dates and notes. Can email registrants from approved senders. Cannot export, edit templates or senders, edit the agreement or switch the CRM for organizations unless added.",
    ["crm.registrations:view", "crm.registrations:manage", "crm.contacts:view", "crm.contacts:edit", "crm.agreement:view", "crm.email:view", "crm.email:create", "crm.templates:view", "crm.senders:view"]),
  T("org_support", "Training Organisation Support", "Helps training organizations: records, teammates and their performance.",
    ["orgs.records:view", "orgs.records:edit", "orgs.members:manage", "orgs.analytics:view", "trainees.profiles:view", "trainees.performance:view", "reports.organizations:view",
      "comms.messages:view", "gaming_ops.results:view"]),
  T("trainee_course_admin", "Trainee and Course Administrator", "Looks after trainees, enrolments, cohorts and courses.",
    [...all("trainees."), ...all("courses."), "chat.rooms:view", "reports.trainees:view", "reports.dashboards:view"]),
  T("content_moderator", "Content Moderator", "Reviews and removes posts, comments, reported listings and chat content.",
    [...all("feed."), "chat.rooms:view", "chat.messages:moderate", "chat.reports:view", "chat.reports:moderate", "partners.listings:moderate", "partners.jobs:moderate", "partners.employers:view"]),
  T("reports_officer", "Reports and Analytics Officer", "Reads dashboards and reports. Cannot export or see sensitive analytics unless added.",
    ["reports.dashboards:view", "reports.organizations:view", "reports.trainees:view", "reports.gaming:view", "reports.platform:view", "orgs.analytics:view", "trainees.performance:view", "gaming_ops.results:view"]),
  T("technical_support", "Technical Support Officer", "Looks at health, diagnostics and sign-in events. Cannot change integrations or restrict accounts unless added.",
    ["security.health:view", "security.diagnostics:view", "security.auth_events:view", "security.logs:view", "platform.audit:view"]),
];

export const templateOf = (key: string | null | undefined): RoleTemplate | undefined => ROLE_TEMPLATES.find((t) => t.key === key);
