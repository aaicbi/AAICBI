/**
 * Dashboard/Examination redesign — the one canonical trainee nav list.
 * Replaces ~15 hand-rolled copies of this array that had drifted into
 * three different, inconsistent shapes (some missing "My Downloads",
 * the four Pitch & Post pages missing half the list entirely). Every
 * trainee page should import this rather than defining its own.
 *
 * My Downloads/Introductions/Job Board/Ask Loop stay reachable via the
 * Quick Actions nav menu (QuickActionsNavMenu) instead of crowding this
 * bar further — this is the top-level set, not the complete site map.
 */
export const TRAINEE_NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "Examinations", href: "/trainee/examinations" },
  { label: "Certificates", href: "/trainee/certificates" },
  { label: "Analytics & Reports", href: "/trainee/my-activity" },
  { label: "Messages", href: "/trainee/messages" },
  { label: "My Profile", href: "/trainee/profile" },
  { label: "Settings", href: "/trainee/settings" },
];
