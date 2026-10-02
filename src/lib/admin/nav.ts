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
 */

/** The general-admin cluster — courses, exams, performance, analytics,
 * messages, payments, and every course/exam sub-page. Examinations now
 * points at the real index (/admin/exams) instead of /admin/dashboard. */
export const ADMIN_NAV = [
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Payments", href: "/admin/payments" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

/** The instructor-management cluster. */
export const ADMIN_NAV_STAFF = [
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Instructors", href: "/admin/instructors" },
  { label: "Agreement Templates", href: "/admin/agreement-templates" },
  { label: "Staff", href: "/admin/staff" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

/** The Pitch & Post review cluster. */
export const ADMIN_NAV_PITCH = [
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Pitches", href: "/admin/pitches" },
  { label: "Pitch Cohorts", href: "/admin/pitch-cohorts" },
  { label: "Investors", href: "/admin/investors" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

/** The SUPER_ADMIN-only utility cluster — legitimately minimal. */
export const ADMIN_NAV_COMMAND = [
  { label: "Examinations", href: "/admin/exams" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Command", href: "/admin/command" },
  { label: "Settings", href: "/admin/settings" },
];
