/**
 * The permission catalogue: every feature of the platform that can be granted, and the actions on it. Pure data, no database, so it can
 * be tested and used by the server, the staff form and the menus alike. See docs/rbac-audit-and-plan.md.
 *
 * A permission key is `category.feature:action`, for example `gaming_studio.games:publish`. Actions are independent: being able to
 * view something never implies being able to change, publish, delete or export it.
 *
 * Two audiences, never mixed:
 *  - "staff" categories are granted to AAICBI staff accounts by a Super Admin.
 *  - the "org_games" category is the set of things a TRAINING ORGANIZATION may do with its own trainees' games. It can never be granted
 *    to staff, and no organization is ever given anything from a "staff" category.
 */
export const ACTIONS = ["view", "create", "edit", "delete", "manage", "approve", "publish", "moderate", "export", "configure", "assign_permissions"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<Action, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete", manage: "Manage", approve: "Approve", publish: "Publish",
  moderate: "Moderate", export: "Export", configure: "Configure", assign_permissions: "Assign permissions",
};
export const ACTION_HELP: Record<Action, string> = {
  view: "Read information and view records.", create: "Create new records or resources.", edit: "Modify existing records.",
  delete: "Delete records or resources.", manage: "Perform operational management actions.", approve: "Approve submitted content or requests.",
  publish: "Publish approved content.", moderate: "Review and take permitted moderation actions.", export: "Download or export permitted data.",
  configure: "Change module settings.", assign_permissions: "Grant permissions to other people, within your own authority.",
};

export type Audience = "staff" | "organization";

export interface Feature {
  /** `category.feature` */
  id: string;
  label: string;
  description: string;
  actions: Action[];
  /** Actions on this feature that are high risk: only a Super Admin may grant them, and the form warns about them. */
  high?: Action[];
}

export interface Category {
  id: string;
  label: string;
  description: string;
  audience: Audience;
  /**
   * When set, every other permission in the category is ignored unless this one is held: "Access Gaming Studio" is the door, and nothing
   * inside it works (or appears) without it.
   */
  gate?: string;
  features: Feature[];
}

const f = (id: string, label: string, description: string, actions: Action[], high?: Action[]): Feature => ({ id, label, description, actions, ...(high ? { high } : {}) });

export const CATEGORIES: Category[] = [
  {
    id: "platform", label: "Platform administration", audience: "staff",
    description: "Running the platform itself: switches, settings, announcements and the audit trail.",
    features: [
      f("platform.command_center", "Command Center", "The Super Admin control room and Loop guide.", ["view", "manage"], ["manage"]),
      f("platform.settings", "Platform settings", "Session lengths, payment and platform-wide settings.", ["view", "configure"], ["configure"]),
      f("platform.features", "Feature switches", "Growth funnel, ads, ecosystem switches, pictures.", ["view", "configure"], ["configure"]),
      f("platform.audit", "Audit log", "The record of sensitive actions.", ["view", "export"], ["export"]),
      f("platform.announcements", "System announcements", "Notices shown to everyone.", ["create", "edit", "publish"]),
      f("platform.maintenance", "Maintenance controls", "Pausing parts of the platform for maintenance.", ["manage"], ["manage"]),
    ],
  },
  {
    id: "staff", label: "Staff and access", audience: "staff",
    description: "Creating staff, roles and permissions. Only the Super Admin, or people the Super Admin trusts with it.",
    features: [
      f("staff.accounts", "Staff accounts", "Create, view, edit, suspend and reactivate staff.", ["view", "create", "edit", "manage"], ["create", "manage"]),
      f("staff.roles", "Roles and templates", "Role templates and custom roles.", ["view", "edit"], ["edit"]),
      f("staff.permissions", "Staff permissions", "Granting and revoking permissions.", ["view", "assign_permissions"], ["assign_permissions"]),
      f("staff.activity", "Staff activity", "What staff have done.", ["view"]),
    ],
  },
  {
    id: "gaming_studio", label: "Gaming Studio", audience: "staff", gate: "gaming_studio.access:view",
    description: "Designing, testing and publishing games. Separate from moderating games, and never available to training organizations.",
    features: [
      f("gaming_studio.access", "Access the Gaming Studio", "The door: without this nothing below works or appears.", ["view"], ["view"]),
      f("gaming_studio.configs", "Game configurations", "Look at the game library, modules and what is assigned, without changing anything.", ["view"]),
      f("gaming_studio.games", "Games", "Create, rename, delete and publish games. Create = new games; Edit = rename and describe; Manage = attach a game to a module; Publish = switch a game live or off, including opening it to visitors.", ["create", "edit", "delete", "publish", "manage"], ["publish", "delete"]),
      f("gaming_studio.testing", "Test games", "Preview and play-test a game as a trainee would, without publishing it.", ["view"]),
      f("gaming_studio.assets", "Game assets", "Items, questions and files used by games.", ["manage"]),
      f("gaming_studio.settings", "Global game settings", "The Ayakbi Arena switches and rules for the platform, an organization or a course.", ["configure"], ["configure"]),
      f("gaming_studio.engine", "Game engine settings", "Rewards, question pools and practice rules.", ["configure"], ["configure"]),
      f("gaming_studio.loop", "Loop in the Studio", "Use and manage Loop inside the Studio.", ["manage"]),
      f("gaming_studio.bank", "Question bank", "Import, review and approve game questions.", ["manage", "approve"]),
    ],
  },
  {
    id: "gaming_ops", label: "Gaming operations and moderation", audience: "staff",
    description: "Watching and moderating games across the platform. Never opens the Gaming Studio.",
    features: [
      f("gaming_ops.results", "Game results", "Scores, attempts and progress of players.", ["view", "export"], ["export"]),
      f("gaming_ops.live", "Live games", "Games being played right now.", ["view"]),
      f("gaming_ops.sessions", "Game sessions", "End or suspend a session.", ["moderate"]),
      f("gaming_ops.reports", "Game reports", "Reports about games and conduct.", ["view", "moderate"]),
      f("gaming_ops.restrictions", "Player restrictions", "Warn, restrict or remove a player.", ["manage"]),
      f("gaming_ops.chat_games", "Group chat games", "Games played inside course group chats.", ["moderate"]),
      f("gaming_ops.incidents", "Incidents and escalations", "Review incidents and handle cases escalated by organizations.", ["view", "manage"]),
      f("gaming_ops.platform", "All organizations", "Moderate games for every organization, not only your assigned scope.", ["moderate"], ["moderate"]),
    ],
  },
  {
    id: "orgs", label: "Training organizations", audience: "staff",
    description: "Organization records, approvals and settings.",
    features: [
      f("orgs.records", "Organization records", "Look at and change organization details.", ["view", "edit"]),
      f("orgs.approvals", "Approvals", "Approve or reject organizations.", ["approve"]),
      f("orgs.status", "Suspension", "Suspend or reinstate an organization.", ["manage"], ["manage"]),
      f("orgs.settings", "Organization settings", "Fees, agreements and organization-level settings.", ["manage"]),
      f("orgs.analytics", "Organization analytics", "How organizations are doing.", ["view"]),
      f("orgs.members", "Organization memberships", "Teammates of an organization.", ["manage"]),
    ],
  },
  {
    id: "trainees", label: "Trainees", audience: "staff",
    description: "Trainee records, enrolments and performance.",
    features: [
      f("trainees.profiles", "Trainee profiles", "Look at and change trainee information.", ["view", "edit"]),
      f("trainees.register", "Register trainees", "Add trainees.", ["create"]),
      f("trainees.enrolments", "Enrolments", "Enrol and unenrol; assign courses.", ["manage"]),
      f("trainees.cohorts", "Cohorts", "Assign trainees to cohorts.", ["manage"]),
      f("trainees.assessments", "Assessments", "Look at exam and assignment results.", ["view"]),
      f("trainees.performance", "Performance reports", "Progress and attendance.", ["view"]),
      f("trainees.restrictions", "Trainee restrictions", "Restrict a trainee's account.", ["manage"]),
    ],
  },
  {
    id: "courses", label: "Courses and learning", audience: "staff",
    description: "Courses, modules and learning material (always limited to courses the person owns or shares).",
    features: [
      f("courses.content", "Course content", "Courses, modules, exams and assignments.", ["create", "edit", "delete", "publish"], ["delete"]),
      f("courses.resources", "Learning resources", "Upload and manage materials.", ["manage"]),
      f("courses.submissions", "Submissions", "Review trainee submissions.", ["view", "approve"]),
      f("courses.cohorts", "Course cohorts", "Manage cohorts of a course.", ["manage"]),
      f("courses.completion", "Completion statistics", "How many finished.", ["view"]),
    ],
  },
  {
    id: "chat", label: "Group chat and community", audience: "staff",
    description: "Course group chats. Private conversations are never included.",
    features: [
      f("chat.rooms", "Group chats", "Look at course group chats.", ["view"]),
      f("chat.messages", "Messages", "Remove inappropriate messages.", ["moderate"]),
      f("chat.reports", "Reported content", "Review reports about chat content.", ["view", "moderate"]),
      f("chat.participants", "Participants", "Restrict or remove a participant.", ["manage"]),
      f("chat.games", "Group chat games", "Manage games in a group chat.", ["manage"]),
      f("chat.incidents", "Incidents", "Review chat-related incidents.", ["view"]),
    ],
  },
  {
    id: "feed", label: "Feed and content moderation", audience: "staff",
    description: "Posts, comments and announcements on the feed.",
    features: [
      f("feed.posts", "Posts", "Review, approve, reject and remove posts.", ["view", "approve", "moderate", "delete"]),
      f("feed.reports", "Reported content", "Handle reports about feed content.", ["moderate"]),
      f("feed.comments", "Comments", "Review and remove comments.", ["moderate"]),
      f("feed.announcements", "Announcements", "Platform announcements on the feed.", ["publish"]),
    ],
  },
  {
    id: "partners", label: "Employers, investors and startups", audience: "staff",
    description: "Employer, investor and startup accounts and their listings.",
    features: [
      f("partners.employers", "Employers", "Look at, approve and moderate employers.", ["view", "approve", "moderate"]),
      f("partners.jobs", "Job listings", "Review and moderate job listings.", ["approve", "moderate"]),
      f("partners.investors", "Investors", "Review investor profiles and content.", ["view", "moderate"]),
      f("partners.startups", "Startups", "Look at and moderate startups.", ["view", "moderate"]),
      f("partners.listings", "Reported listings", "Review reported listings.", ["moderate"]),
    ],
  },
  {
    id: "comms", label: "Messaging and notifications", audience: "staff",
    description: "Notifications, announcements and communication records.",
    features: [
      f("comms.messages", "Messages", "Permitted communication logs.", ["view"]),
      f("comms.notifications", "Notifications", "Manage platform notifications.", ["manage"]),
      f("comms.announcements", "Announcements", "Send announcements.", ["create"]),
      f("comms.templates", "Notification templates", "Edit templates.", ["edit"]),
      f("comms.incidents", "Communication incidents", "Review reported communication incidents.", ["moderate"]),
    ],
  },
  {
    id: "reports", label: "Reports and analytics", audience: "staff",
    description: "Dashboards and reports.",
    features: [
      f("reports.dashboards", "Dashboards", "Standard dashboards.", ["view"]),
      f("reports.organizations", "Organization reports", "", ["view"]),
      f("reports.trainees", "Trainee performance reports", "", ["view"]),
      f("reports.gaming", "Gaming reports", "", ["view"]),
      f("reports.platform", "Platform-wide statistics", "", ["view"]),
      f("reports.export", "Export reports", "Download reports as files.", ["export"], ["export"]),
      f("reports.sensitive", "Sensitive analytics", "Reports containing personal details.", ["view"], ["view"]),
    ],
  },
  {
    id: "billing", label: "Billing and commercial", audience: "staff",
    description: "Payments and fees. Kept separate from general administration.",
    features: [
      f("billing.payments", "Payment records", "Look at payments.", ["view"]),
      f("billing.fees", "Subscriptions and fees", "Manage subscriptions and fees.", ["manage"], ["manage"]),
      f("billing.transactions", "Transactions", "Review transactions.", ["view"]),
      f("billing.settings", "Commercial settings", "Commission rates, prices and payment settings.", ["configure"], ["configure"]),
      f("billing.reports", "Financial reports", "Generate and export financial reports.", ["export"], ["export"]),
    ],
  },
  {
    id: "security", label: "Security and technical", audience: "staff",
    description: "Security logs and technical operations. Passwords, keys and tokens are never shown through these.",
    features: [
      f("security.logs", "Security logs", "", ["view"], ["view"]),
      f("security.auth_events", "Sign-in events", "", ["view"], ["view"]),
      f("security.restrictions", "Account restrictions", "Block or limit an account.", ["manage"], ["manage"]),
      f("security.health", "Application health", "", ["view"]),
      f("security.integrations", "Integrations", "Manage connections to other services.", ["manage"], ["manage"]),
      f("security.diagnostics", "System diagnostics", "", ["view"]),
    ],
  },
  {
    id: "events", label: "Events and live sessions", audience: "staff",
    description: "The platform Event Manager: AAICBI's own events and the promotion of training organizations' events. Nobody has these by default except the Super Admin.",
    features: [
      f("events.global", "Global events and calendar", "See every event on the platform, including organizations' private ones, and the global calendar.", ["view"], ["view"]),
      f("events.platform", "Platform events", "Create and edit AAICBI's own events. Publish = make a public event live. Delete = cancel and archive.", ["create", "edit", "publish", "delete"]),
      f("events.categories", "Event categories", "Create, rename and switch off event categories.", ["manage"]),
      f("events.promotions", "Promotion requests", "Review organizations' requests for public promotion. Approve = approve, reject or ask for changes. Publish = put an approved event on the public pages.", ["view", "approve", "publish"]),
      f("events.registrations", "Registrations and attendance", "See who registered for platform events and keep the attendance register.", ["view", "manage", "export"], ["export"]),
      f("events.analytics", "Event analytics", "Participation and engagement across events.", ["view"]),
      f("events.settings", "Event settings", "Switch the Event Manager, organization events, promotion and registration on or off.", ["configure"], ["configure"]),
    ],
  },
  {
    id: "crm", label: "CRM and registrations", audience: "staff",
    description: "Course registrations and the people behind them: who registered, what they agreed to, and follow-up. Staff see AAICBI's own registrations; training organizations see only their own, when the Super Admin has switched the CRM on for them.",
    features: [
      f("crm.registrations", "Registrations", "See registrations and the timeline. Manage = change the stage, set follow-up dates, add notes and finish tasks. Export = download as CSV.", ["view", "manage", "export"], ["export"]),
      f("crm.contacts", "Contacts", "See and correct contact details and consent.", ["view", "edit"]),
      f("crm.email", "Email", "See the emails sent to a contact and how they were delivered. Create = write and send an email (or a test, a draft or a scheduled one) from a registration.", ["view", "create"]),
      f("crm.templates", "Email templates", "Read templates. Edit = change a template (every change is a new version).", ["view", "edit"]),
      f("crm.senders", "Email senders", "See the approved sender addresses. Manage = add or change them and confirm their domain is verified in Resend.", ["view", "manage"], ["manage"]),
      f("crm.agreement", "Registration agreement", "Read the agreement everyone signs, and publish a new version of it.", ["view", "edit"], ["edit"]),
      f("crm.settings", "CRM switches", "Switch the CRM on or off for each training organization.", ["configure"], ["configure"]),
    ],
  },
  {
    id: "org_games", label: "Organization games (training organizations only)", audience: "organization",
    description: "What a training organization may do with games played by its own trainees. Set per organization by a Super Admin.",
    features: [
      f("org_games.results", "Game results", "Scores, attempts, progress and leaderboards of the organization's own trainees.", ["view", "export"]),
      f("org_games.live", "Live games", "Games being played by the organization's trainees now.", ["view"]),
      f("org_games.sessions", "Game sessions", "End or suspend a session.", ["moderate"]),
      f("org_games.reports", "Reports and incidents", "Review reports, warn, and escalate to a Super Admin.", ["view", "moderate"]),
      f("org_games.restrictions", "Trainee participation", "Restrict a trainee or remove them from a game.", ["manage"]),
      f("org_games.chat_games", "Course group chat games", "Moderate games in the organization's course chats.", ["moderate"]),
      f("org_games.settings", "Game settings for its courses", "Switch supported games on or off for its own courses and set course participation rules.", ["configure"]),
    ],
  },
  {
    id: "org_events", label: "Organization events (training organizations only)", audience: "organization",
    description: "What a training organization may do with its own events and live sessions. Never includes platform events or other organizations' events.",
    features: [
      f("org_events.events", "Organization events", "See its own events and calendar. Create = new events and drafts. Edit = change them, reschedule and cancel.", ["view", "create", "edit"]),
      f("org_events.media", "Event flyers and videos", "Upload promotional pictures and videos.", ["manage"]),
      f("org_events.registrations", "Registrations and attendance", "See who registered, decide registrations and keep the attendance register.", ["view", "manage", "export"]),
      f("org_events.promotion", "Public promotion", "Ask the Super Admin to promote an event publicly, and follow the request.", ["view", "create"]),
    ],
  },
  {
    id: "org_crm", label: "Organization CRM (training organizations only)", audience: "organization",
    description: "What a training organization may do with registrations for its own courses. Only when a Super Admin has switched the CRM on for it.",
    features: [
      f("org_crm.registrations", "Registrations", "See its own registrations and timelines. Manage = change the stage, set follow-up dates, add notes and finish tasks.", ["view", "manage", "export"]),
      f("org_crm.contacts", "Contacts", "See its own contacts and what they agreed to.", ["view"]),
      f("org_crm.email", "Email", "See the emails sent to its own contacts. Create = write and send one, as the organization via AAICBI.", ["view", "create"]),
      f("org_crm.templates", "Email templates", "Read the email templates AAICBI provides.", ["view"]),
    ],
  },
];

export const key = (featureId: string, action: Action): string => `${featureId}:${action}`;

export interface PermissionInfo {
  key: string;
  categoryId: string;
  featureId: string;
  featureLabel: string;
  action: Action;
  audience: Audience;
  high: boolean;
}

export const PERMISSIONS: PermissionInfo[] = CATEGORIES.flatMap((c) =>
  c.features.flatMap((ft) => ft.actions.map((a) => ({ key: key(ft.id, a), categoryId: c.id, featureId: ft.id, featureLabel: ft.label, action: a, audience: c.audience, high: !!ft.high?.includes(a) }))),
);
const BY_KEY = new Map(PERMISSIONS.map((p) => [p.key, p]));

export const isPermissionKey = (k: unknown): k is string => typeof k === "string" && BY_KEY.has(k);
export const infoOf = (k: string): PermissionInfo | undefined => BY_KEY.get(k);
export const categoryOf = (k: string): Category | undefined => CATEGORIES.find((c) => c.id === BY_KEY.get(k)?.categoryId);

/** Everything a Super Admin holds: every staff permission. Organization-only permissions are never part of it. */
export const STAFF_PERMISSIONS: string[] = PERMISSIONS.filter((p) => p.audience === "staff").map((p) => p.key);
export const ORG_PERMISSIONS: string[] = PERMISSIONS.filter((p) => p.audience === "organization").map((p) => p.key);
export const HIGH_RISK: string[] = PERMISSIONS.filter((p) => p.high).map((p) => p.key);
export const isHighRisk = (k: string): boolean => !!BY_KEY.get(k)?.high;

/** Keeps only real keys, once each, in catalogue order. */
export function cleanKeys(input: unknown, audience: Audience = "staff"): string[] {
  if (!Array.isArray(input)) return [];
  const want = new Set(input.filter((x): x is string => typeof x === "string"));
  return PERMISSIONS.filter((p) => p.audience === audience && want.has(p.key)).map((p) => p.key);
}

/** Removes anything the category's gate does not allow (nothing inside the Gaming Studio counts without access to it). */
export function applyGates(keys: Iterable<string>): Set<string> {
  const have = new Set(keys);
  for (const c of CATEGORIES) {
    if (!c.gate || have.has(c.gate)) continue;
    for (const p of PERMISSIONS) if (p.categoryId === c.id) have.delete(p.key);
  }
  return have;
}
