/**
 * Dashboard/Examination redesign — the one canonical trainee nav list.
 * Replaces ~15 hand-rolled copies of this array that had drifted into
 * three different, inconsistent shapes (some missing "My Downloads",
 * the four Pitch & Post pages missing half the list entirely). Every
 * trainee page should import this rather than defining its own.
 *
 * Sidebar rollout (Phase 2) — "Ask Loop" and "My Downloads" moved here
 * from the now-removed QuickActionsNavMenu dropdown (its other 5
 * shortcuts already duplicated this list; see TraineeSidebar.tsx's own
 * comment), so nothing lost reach once that dropdown went away.
 * "My Profile" was removed — the sidebar's own account card, linking
 * to the same page, replaced it (same reasoning as admin's nav.ts).
 * Introductions/Job Board stay off this list — genuinely secondary
 * career features, reachable from the dashboard's own Quick Actions
 * card.
 */
export const TRAINEE_NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "Examinations", href: "/trainee/examinations" },
  { label: "Certificates", href: "/trainee/certificates" },
  { label: "Analytics & Reports", href: "/trainee/my-activity" },
  { label: "Messages", href: "/trainee/messages" },
  { label: "Ask Loop", href: "/trainee/buddy" },
  { label: "My Downloads", href: "/trainee/downloads" },
  { label: "Settings", href: "/trainee/settings" },
];
