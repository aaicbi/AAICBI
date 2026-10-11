/**
 * The phone bottom navigation: a few places people go several times a day,
 * chosen per kind of account from what that account actually has. Everything
 * else lives behind "More", which lists the account's full menu. Pages that
 * do not exist for an account are never offered (investors have no messaging,
 * so they get no Messages tab). Feed is a main tab for every account; Alerts
 * moved into "More" (with its unread count shown on the More button).
 */
export type NavRole = "trainee" | "employer" | "investor" | "instructor" | "organization" | "staff";
export type NavIconKey = "home" | "messages" | "events" | "talent" | "jobs" | "courses" | "organizations" | "alerts" | "feed" | "post";

export interface BottomNavItem {
  key: NavIconKey;
  label: string;
  href: string;
}

export const BOTTOM_NAV: Record<NavRole, BottomNavItem[]> = {
  trainee: [
    { key: "home", label: "Home", href: "/trainee/dashboard" },
    { key: "messages", label: "Messages", href: "/trainee/messages" },
    { key: "post", label: "Post", href: "/compose" },
    { key: "feed", label: "Feed", href: "/feed" },
  ],
  employer: [
    { key: "home", label: "Home", href: "/employer/dashboard" },
    { key: "messages", label: "Messages", href: "/employer/messages" },
    { key: "post", label: "Post", href: "/compose" },
    { key: "feed", label: "Feed", href: "/feed" },
  ],
  investor: [
    { key: "home", label: "Home", href: "/investor/dashboard" },
    { key: "organizations", label: "Organizations", href: "/investor/organizations" },
    { key: "post", label: "Post", href: "/compose" },
    { key: "feed", label: "Feed", href: "/feed" },
  ],
  instructor: [
    { key: "home", label: "Home", href: "/instructor/dashboard" },
    { key: "courses", label: "Courses", href: "/instructor/courses" },
    { key: "post", label: "Post", href: "/compose" },
    { key: "feed", label: "Feed", href: "/feed" },
  ],
  organization: [
    { key: "home", label: "Overview", href: "/admin/organization" },
    { key: "messages", label: "Messages", href: "/admin/messages" },
    { key: "post", label: "Post", href: "/compose" },
    { key: "feed", label: "Feed", href: "/feed" },
  ],
  staff: [
    { key: "home", label: "Home", href: "/admin/dashboard" },
    { key: "messages", label: "Messages", href: "/admin/messages" },
    { key: "post", label: "Post", href: "/compose" },
    { key: "feed", label: "Feed", href: "/feed" },
  ],
};

/** Extra places worth a tap from "More" that are not in the role's own menu (the ecosystem pages everyone can browse). */
export const MORE_EXTRAS: Record<NavRole, Array<{ label: string; href: string }>> = {
  trainee: [{ label: "Events", href: "/events" }],
  employer: [{ label: "Events", href: "/events" }, { label: "Training organizations", href: "/organizations" }, { label: "Talent", href: "/employer/discover" }],
  investor: [{ label: "Events", href: "/events" }],
  instructor: [{ label: "Events", href: "/events" }],
  organization: [{ label: "Events", href: "/admin/organization/events" }],
  staff: [{ label: "Events", href: "/events" }],
};

/** Live exams and assessments lock navigation on purpose; the bar stays out of the way there. */
export function bottomNavHidden(pathname: string): boolean {
  const s = pathname.split("/").filter(Boolean);
  return s[0] === "exam" || s.includes("take");
}

/** Whether a tab is the current place. The home tab matches only itself, not everything below it. */
export function isTabActive(item: BottomNavItem, pathname: string): boolean {
  if (item.key === "home") return pathname === item.href;
  // The feed is the public home page too, so it is the current place on "/" as well as "/feed".
  if (item.key === "feed") return pathname === "/" || pathname === item.href || pathname.startsWith(item.href + "/");
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function unreadLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}
