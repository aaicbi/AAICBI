/**
 * Admin Dashboard & Examinations redesign (Phase 2) — the canonical
 * admin nav lists, replacing 10 distinct, drifted variants found across
 * 42 admin pages (worse drift than the trainee side had pre-Phase-1):
 * missing Payments in one cluster, missing Analytics on the dashboard's
 * own nav, missing Pitch Cohorts on Investors, and a straight
 * copy-paste mistake (the Question Bank review page linking to the
 * SUPER_ADMIN-only Command Center).
 *
 * Unlike the trainee side (one page type, one list), admin genuinely
 * has distinct page clusters with legitimately different nav needs —
 * so this is four named constants, not one flattened list, each fixed
 * to its own most-complete, correct variant rather than forcing false
 * uniformity.
 *
 * Admin sidebar pilot — "My Profile" was removed from the three
 * clusters that had it (ADMIN_NAV_COMMAND never did): the sidebar now
 * has its own account card (photo + name + role) right under the
 * logo, already linking to /admin/profile, so the plain text link was
 * a second way to reach the exact same page — same reasoning as
 * removing the Quick Actions dropdown for duplicating this file's own
 * links.
 */

/** The general-admin cluster — courses, exams, performance, analytics,
 * messages, payments, and every course/exam sub-page. Examinations now
 * points at the real index (/admin/exams) instead of /admin/dashboard.
 *
 * Bug fix: when Examinations was repointed at /admin/exams, nothing
 * replaced it as a way back to the dashboard — every one of these four
 * lists went from zero-effort reachable (Examinations WAS the
 * dashboard) to completely unreachable from the top nav once you
 * navigated away from it. "Dashboard" is a real, explicit nav item
 * now, first in every list, matching TRAINEE_NAV's own convention. */
export const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Examinations", href: "/admin/exams" },
  // AI Assignment Engine — deliberately its own nav entry, not folded
  // under Examinations: the product spec itself insists this is not an
  // exam concept (no timer/lockdown), and course-content authors
  // already expect "Examinations" to mean the MCQ exam engine.
  { label: "Assignments", href: "/admin/assignments" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Payments", href: "/admin/payments" },
  // Community Showcase moderation — general content review, alongside
  // Courses/Exams, not a staff/pitch/command-specific concern.
  { label: "Showcase", href: "/admin/showcase" },
  // Training Organizations, Phase 1 — a platform-wide trust/account
  // decision (same reasoning as Employer/Investor already in this
  // list's own precedent), general enough for the default cluster.
  { label: "Training Organizations", href: "/admin/training-organizations" },
  { label: "Settings", href: "/admin/settings" },
];

/** The instructor-management cluster. */
export const ADMIN_NAV_STAFF = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Instructors", href: "/admin/instructors" },
  { label: "Agreement Templates", href: "/admin/agreement-templates" },
  { label: "Staff", href: "/admin/staff" },
  { label: "Settings", href: "/admin/settings" },
];

/** The Pitch & Post review cluster. */
export const ADMIN_NAV_PITCH = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Pitches", href: "/admin/pitches" },
  { label: "Pitch Cohorts", href: "/admin/pitch-cohorts" },
  { label: "Investors", href: "/admin/investors" },
  { label: "Settings", href: "/admin/settings" },
];

/** The SUPER_ADMIN-only utility cluster — legitimately minimal. */
export const ADMIN_NAV_COMMAND = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Command", href: "/admin/command" },
  { label: "Settings", href: "/admin/settings" },
];

/**
 * Training Organizations, Phase 2 — a training-org-backed ADMIN session
 * (see src/lib/trainingOrgStaff.ts) reuses the real admin course-builder
 * directly, but should only ever reach the slice of it research
 * confirmed is actually scoped to its own courses: GET /api/courses,
 * GET /api/exams, GET /api/courses/[id]/performance and
 * GET /api/admin/payments all correctly filter by createdById for a
 * plain ADMIN with no SUPER_ADMIN-only bypass. Deliberately excluded,
 * even though a real staff ADMIN sees them in ADMIN_NAV: Analytics
 * (confirmed unscoped for ADMIN — see the 404 guard this organization's
 * session also hits if it tries the URL directly), Messages (never
 * confirmed scoped, left out conservatively), Showcase, Training
 * Organizations, and every staff/pitch/command-specific page (none of
 * which make sense for a single external organization anyway).
 */
export const ADMIN_NAV_TRAINING_ORG = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Examinations", href: "/admin/exams" },
  // AI Assignment Engine — safely scoped the same way Courses/
  // Examinations already are: requireOwnedAssignment mirrors
  // requireOwnedCourse's own SUPER_ADMIN-bypass/strict-ADMIN-scoping
  // exactly, so a training-org-backed ADMIN session only ever sees its
  // own organization's assignments here, same as every other item in
  // this cluster.
  { label: "Assignments", href: "/admin/assignments" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Payments", href: "/admin/payments" },
  // Training Organizations, Phase 2 — org admins can now design their
  // own certificate templates (requireTrainingOrgAccess scopes the
  // underlying routes to this exact org); /admin/certificate-templates
  // is the id-less entry point that resolves to this org's own page.
  { label: "Certificates", href: "/admin/certificate-templates" },
  { label: "Settings", href: "/admin/settings" },
];

/**
 * Admin sidebar pilot — picks which of the four clusters above a given
 * admin path belongs to. Each individual page used to import the
 * "right" constant itself (fine for a per-page top nav, but the new
 * sidebar is rendered once in src/app/admin/layout.tsx with no
 * per-page input), so this is the single place that now encodes the
 * same clustering as a path lookup instead. Plain prefix checks are
 * sufficient here — unlike tourGuideContent.ts's segment-exact
 * matching, a sidebar's job is just "which cluster", not "which
 * specific page", so a detail page under a cluster's prefix (e.g.
 * /admin/instructors/abc123) correctly resolves to the same cluster
 * as its list page.
 *
 * Training Organizations, Phase 2 — `isTrainingOrg` is checked first and
 * short-circuits every other cluster: a training-org-backed session has
 * no business in the staff/pitch/command clusters regardless of which
 * path it's on (it can't actually reach most of those pages anyway, but
 * the sidebar itself should never even suggest them).
 */
export function getSidebarNavForPath(pathname: string, isTrainingOrg?: boolean) {
  if (isTrainingOrg) {
    return ADMIN_NAV_TRAINING_ORG;
  }
  if (
    pathname.startsWith("/admin/instructors") ||
    pathname.startsWith("/admin/agreement-templates") ||
    pathname.startsWith("/admin/staff")
  ) {
    return ADMIN_NAV_STAFF;
  }
  if (
    pathname.startsWith("/admin/pitches") ||
    pathname.startsWith("/admin/pitch-cohorts") ||
    pathname.startsWith("/admin/investors")
  ) {
    return ADMIN_NAV_PITCH;
  }
  if (pathname.startsWith("/admin/command")) {
    return ADMIN_NAV_COMMAND;
  }
  return ADMIN_NAV;
}

/* -------------------------------------------------------------------------
 * One grouped admin sidebar.
 *
 * The four path-based lists above made the sidebar swap its contents as
 * a user moved between pages (Courses → Instructors dropped Payments and
 * added Staff), so nobody could build a spatial memory of the menu. The
 * sidebar now renders ONE structure, grouped by task, and each item
 * declares who it is for. The constants above remain only because every
 * page still passes one to SiteHeader, which renders nothing while the
 * sidebar is active.
 *
 * Visibility here is a usability filter, not the security boundary: each
 * route and API enforces its own role check (requireRole), which is what
 * actually protects the page.
 * ---------------------------------------------------------------------- */

export interface AdminNavItem {
  label: string;
  href: string;
}

export interface AdminNavGroup {
  /** null renders the group without a heading (used for the lone Dashboard link). */
  label: string | null;
  items: AdminNavItem[];
}

/**
 * Who sees an item. "staff" is every AAICBI staff role; the roles
 * narrow it. "org" is a training organization's own admin session.
 */
type Audience = "staff" | "admins" | "superadmin" | "org" | "staffAndOrg";

interface DefinedItem extends AdminNavItem {
  audience: Audience;
}

const GROUPS: Array<{ label: string | null; items: DefinedItem[] }> = [
  { label: null, items: [{ label: "Dashboard", href: "/admin/dashboard", audience: "staffAndOrg" }] },
  {
    label: "Teaching",
    items: [
      { label: "Courses", href: "/admin/courses", audience: "staffAndOrg" },
      { label: "Examinations", href: "/admin/exams", audience: "staffAndOrg" },
      { label: "Assignments", href: "/admin/assignments", audience: "staffAndOrg" },
      { label: "Certificates", href: "/admin/certificate-templates", audience: "org" },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Overview", href: "/admin/organization", audience: "org" },
      { label: "Team", href: "/admin/organization/team", audience: "org" },
      { label: "Public profile", href: "/admin/organization/profile", audience: "org" },
      { label: "Education videos", href: "/admin/education", audience: "org" },
      { label: "Program skills", href: "/admin/organization/programs", audience: "org" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Training Organizations", href: "/admin/training-organizations", audience: "admins" },
      { label: "Instructors", href: "/admin/instructors", audience: "admins" },
      { label: "Agreement Templates", href: "/admin/agreement-templates", audience: "admins" },
      { label: "Staff", href: "/admin/staff", audience: "superadmin" },
    ],
  },
  {
    label: "Insight",
    items: [
      { label: "Performance", href: "/admin/performance", audience: "staffAndOrg" },
      { label: "Analytics", href: "/admin/analytics", audience: "staff" },
      { label: "Messages", href: "/admin/messages", audience: "staff" },
    ],
  },
  {
    label: "Money",
    items: [{ label: "Payments", href: "/admin/payments", audience: "staffAndOrg" }],
  },
  {
    label: "Community and pitching",
    items: [
      { label: "Showcase", href: "/admin/showcase", audience: "admins" },
      { label: "Pitches", href: "/admin/pitches", audience: "staff" },
      { label: "Pitch Cohorts", href: "/admin/pitch-cohorts", audience: "staff" },
      { label: "Investors", href: "/admin/investors", audience: "admins" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Command Center", href: "/admin/command", audience: "superadmin" },
      { label: "Ecosystem", href: "/admin/ecosystem", audience: "superadmin" },
      { label: "Design System", href: "/admin/design-system", audience: "admins" },
      { label: "Settings", href: "/admin/settings", audience: "staffAndOrg" },
    ],
  },
];

function isVisible(audience: Audience, role: string, isTrainingOrg: boolean): boolean {
  if (isTrainingOrg) return audience === "org" || audience === "staffAndOrg";
  switch (audience) {
    case "org":
      return false;
    case "staff":
    case "staffAndOrg":
      return true;
    case "admins":
      return role === "SUPER_ADMIN" || role === "ADMIN";
    case "superadmin":
      return role === "SUPER_ADMIN";
  }
}

/** The grouped sidebar structure for a session, empty groups removed. */
export function getAdminNavGroups(role: string, isTrainingOrg = false): AdminNavGroup[] {
  return GROUPS.map((g) => ({
    label: g.label,
    items: g.items
      .filter((i) => isVisible(i.audience, role, isTrainingOrg))
      .map(({ label, href }) => ({ label, href })),
  })).filter((g) => g.items.length > 0);
}
