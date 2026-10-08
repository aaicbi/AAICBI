/**
 * The phone bottom navigation: a few places people go several times a day,
 * chosen per kind of account from what that account actually has. Everything
 * else lives behind "More", which lists the account's full menu. Pages that
 * do not exist for an account are never offered (employers and investors have
 * no messaging yet, so they get no Messages tab).
 */
export type NavRole = "trainee" | "employer" | "investor" | "instructor" | "organization" | "staff";
export type NavIconKey = "home" | "messages" | "events" | "talent" | "jobs" | "courses" | "organizations" | "alerts";

export interface BottomNavItem {
  key: NavIconKey;
  label: string;
  href: string;
}

export const BOTTOM_NAV: Record<NavRole, BottomNavItem[]> = {
  trainee: [
    { key: "home", label: "Home", href: "/trainee/dashboard" },
    { key: "messages", label: "Messages", href: "/trainee/messages" },
    { key: "events", label: "Events", href: "/events" },
    { key: "alerts", label: "Alerts", href: "/notifications" },
  ],
  employer: [
    { key: "home", label: "Home", href: "/employer/dashboard" },
    { key: "talent", label: "Talent", href: "/employer/discover" },
    { key: "jobs", label: "Jobs", href: "/employer/job-postings" },
    { key: "alerts", label: "Alerts", href: "/notifications" },
  ],
  investor: [
    { key: "home", label: "Home", href: "/investor/dashboard" },
    { key: "organizations", label: "Organizations", href: "/investor/organizations" },
    { key: "alerts", label: "Alerts", href: "/notifications" },
  ],
  instructor: [
    { key: "home", label: "Home", href: "/instructor/dashboard" },
    { key: "courses", label: "Courses", href: "/instructor/courses" },
    { key: "alerts", label: "Alerts", href: "/notifications" },
  ],
  organization: [
    { key: "home", label: "Overview", href: "/admin/organization" },
    { key: "courses", label: "Courses", href: "/admin/courses" },
    { key: "events", label: "Events", href: "/admin/organization/events" },
    { key: "alerts", label: "Alerts", href: "/notifications" },
  ],
  staff: [
    { key: "home", label: "Home", href: "/admin/dashboard" },
    { key: "messages", label: "Messages", href: "/admin/messages" },
    { key: "courses", label: "Courses", href: "/admin/courses" },
    { key: "alerts", label: "Alerts", href: "/notifications" },
  ],
};

/** Extra places worth a tap from "More" that are not in the role's own menu (the ecosystem pages everyone can browse). */
export const MORE_EXTRAS: Record<NavRole, Array<{ label: string; href: string }>> = {
  trainee: [],
  employer: [{ label: "Events", href: "/events" }, { label: "Training organizations", href: "/organizations" }],
  investor: [{ label: "Events", href: "/events" }],
  instructor: [],
  organization: [],
  staff: [],
};

/** Live exams and assessments lock navigation on purpose; the bar stays out of the way there. */
export function bottomNavHidden(pathname: string): boolean {
  const s = pathname.split("/").filter(Boolean);
  return s[0] === "exam" || s.includes("take");
}

/** Whether a tab is the current place. The home tab matches only itself, not everything below it. */
export function isTabActive(item: BottomNavItem, pathname: string): boolean {
  if (item.key === "home") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function unreadLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}
