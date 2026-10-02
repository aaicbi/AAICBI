/**
 * Content for the platform-wide "page help" button
 * (src/components/TourGuideButton.tsx) — one small table instead of
 * per-page props threaded through dozens of files, matching this
 * app's existing "mount once in root layout" pattern for
 * `ToastProvider`/`CookieConsentBanner`.
 *
 * Deliberately not exhaustive — see the plan's own trim: writing
 * genuinely useful notes for every route in this app isn't realistic
 * in one pass, and invented filler would be worse than none. Covers
 * the highest-traffic page on each side of the platform; every other
 * page gets DEFAULT_TOUR_ENTRY's honest, genuinely-generic tip.
 * Adding a new page's notes later is a one-line addition here — no
 * component changes needed.
 */

export interface TourGuideEntry {
  match: (pathname: string) => boolean;
  title: string;
  notes: string[];
}

/** `pattern` segments starting with `:` match any single path segment —
 * e.g. "/trainee/courses/:id" matches "/trainee/courses/abc123" but not
 * the bare list page or anything nested deeper under it. Segment-count
 * matching means entries never need to be ordered by specificity. */
function matchesPattern(pathname: string, pattern: string): boolean {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return false;
  return patternParts.every((part, i) => part.startsWith(":") || part === pathParts[i]);
}

function exact(pattern: string) {
  return (pathname: string) => matchesPattern(pathname, pattern);
}

export const TOUR_GUIDE_CONTENT: TourGuideEntry[] = [
  // Public
  {
    match: exact("/"),
    title: "Welcome to AAICBI",
    notes: [
      "Browse what's available from the Courses link in the menu above.",
      "Courses marked \"Free\" don't require any payment to start.",
      "Create a trainee account to enroll and start learning.",
    ],
  },
  {
    match: exact("/courses"),
    title: "Course Catalogue",
    notes: [
      "Use the search bar to find a course by name, topic, or category.",
      "A pulsing \"Try the first N modules free\" note means you can preview a paid course before paying.",
      "Scroll down for courses that haven't opened for registration yet.",
    ],
  },
  {
    match: exact("/courses/:id"),
    title: "Course Details",
    notes: [
      "This page shows the full outline, pricing, and what you'll learn.",
      "Sign in first if you already have a trainee account, then enroll or pay from here.",
      "A free preview (when offered) lets you try the first few modules before paying.",
    ],
  },
  // Trainee
  {
    match: exact("/trainee/dashboard"),
    title: "Your Dashboard",
    notes: [
      "\"Continue Learning\" always picks up exactly where you left off.",
      "Quick Actions give you one-click shortcuts — click \"Show more\" to see everything.",
      "The bell icon in the sidebar shows your notifications.",
    ],
  },
  {
    match: exact("/trainee/courses"),
    title: "Your Courses",
    notes: [
      "Every course you have access to appears here.",
      "Click a course to open its modules and lessons.",
      "A locked module means you need to finish the one before it first.",
    ],
  },
  {
    match: exact("/trainee/courses/:id"),
    title: "Course Content",
    notes: [
      "Click a module to expand it and see its lessons and assessment.",
      "Mark each lesson complete to unlock the next module in sequence.",
      "A \"Pay to continue\" banner means you've used up your free preview of this course.",
    ],
  },
  {
    match: exact("/trainee/examinations"),
    title: "Examinations",
    notes: [
      "Every module assessment and course examination you have, in one table.",
      "The Status column shows whether you can start, continue, or need to pay first.",
      "Click \"View Result\" on a passed row to see your score summary.",
    ],
  },
  {
    match: exact("/trainee/certificates"),
    title: "Certificates",
    notes: [
      "Every certificate you've earned by passing a course examination appears here.",
      "Click a certificate to open its public, verifiable page.",
      "That link is safe to share — anyone can confirm it's genuine, without logging in.",
    ],
  },
  {
    match: exact("/trainee/my-activity"),
    title: "Analytics & Reports",
    notes: [
      "A snapshot of your own learning activity and assessment performance.",
      "Download a PDF copy of your report using the button at the top.",
      "Your interests are inferred from what you've actually been exploring — not a label.",
    ],
  },
  // Admin
  {
    match: exact("/admin/dashboard"),
    title: "Admin Dashboard",
    notes: [
      "Your personal landing page — the full examinations list now lives under \"Examinations\" in the sidebar.",
      "Pending-approval tiles only appear when there's genuinely something to review.",
      "Quick Actions give you shortcuts to the admin areas you use most.",
    ],
  },
  {
    match: exact("/admin/exams"),
    title: "Examinations",
    notes: [
      "Every standalone examination you have access to, scoped to your role.",
      "\"Questions\" opens the question bank; \"Results\" shows attempts and scores.",
      "\"+ Create Examination\" starts a brand new one.",
    ],
  },
  {
    match: exact("/admin/courses"),
    title: "Courses",
    notes: [
      "Every course you can manage.",
      "Click a course to edit its modules, lessons, and pricing.",
      "Use \"+ Create Course\" to start a new one from scratch.",
    ],
  },
];

export const DEFAULT_TOUR_ENTRY: TourGuideEntry = {
  match: () => true,
  title: "Getting Around",
  notes: [
    "Use the navigation bar at the top of the page to move between sections.",
    "Your account menu and notifications are in the top-right corner.",
    "If something looks locked or unavailable, it usually means a previous step needs finishing first.",
  ],
};

/**
 * Sidebar rollout (Phase 2) — a second default, for pages that render
 * inside a role's persistent left sidebar instead of the plain top
 * header DEFAULT_TOUR_ENTRY above describes. Every role's own
 * `<Role>Sidebar.tsx` "Page Help" trigger falls back to this one
 * (via getSidebarTourGuideContent) for any page not explicitly listed
 * in TOUR_GUIDE_CONTENT above — which today is most of Employer/
 * Investor/Instructor and much of Admin/Trainee, since this table is
 * deliberately not exhaustive. DEFAULT_TOUR_ENTRY itself is untouched
 * and still correct for its own remaining audience: TourGuideButton's
 * floating button, which (per sidebarRoutes.ts) only ever shows on
 * pages that still have the old top header — public pages and every
 * role's pre-auth pages.
 */
export const DEFAULT_TOUR_ENTRY_SIDEBAR: TourGuideEntry = {
  match: () => true,
  title: "Getting Around",
  notes: [
    "Use the sidebar on the left to move between sections.",
    "Your notifications and account are near the top of the sidebar.",
    "If something looks locked or unavailable, it usually means a previous step needs finishing first.",
  ],
};

export function getTourGuideContent(pathname: string): TourGuideEntry {
  return TOUR_GUIDE_CONTENT.find((entry) => entry.match(pathname)) ?? DEFAULT_TOUR_ENTRY;
}

export function getSidebarTourGuideContent(pathname: string): TourGuideEntry {
  return TOUR_GUIDE_CONTENT.find((entry) => entry.match(pathname)) ?? DEFAULT_TOUR_ENTRY_SIDEBAR;
}
