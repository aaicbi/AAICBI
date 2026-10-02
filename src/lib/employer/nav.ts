/**
 * Sidebar rollout (Phase 2) — the one canonical employer nav list,
 * replacing a `const NAV = [...]` copy-pasted across 8 pages with one
 * real drift bug: the dashboard page's own copy was missing the
 * "Dashboard" self-link every other page's copy had, fixed here by
 * centralizing to a single source (same reasoning as admin/trainee's
 * own nav.ts files).
 *
 * "My Profile" was removed — EmployerSidebar.tsx's own account card,
 * linking to the same page, replaced it.
 */
export const EMPLOYER_NAV = [
  { label: "Dashboard", href: "/employer/dashboard" },
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];
