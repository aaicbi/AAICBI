import type { MeKind } from "@/lib/guide/context";

/**
 * Where the installed app opens. The manifest's start_url is a single
 * address (/app) for every kind of account; this decides the real page
 * from who is signed in. A shortcut such as "Messages" adds ?to=messages
 * and lands on that role's own messages page when it has one, and on the
 * role's home otherwise.
 */
export type LaunchTarget = "messages" | "events" | "notifications" | "opportunities";
export const LAUNCH_TARGETS: readonly LaunchTarget[] = ["messages", "events", "notifications", "opportunities"];

const HOME: Record<MeKind, string> = {
  trainee: "/trainee/dashboard",
  employer: "/employer/dashboard",
  investor: "/investor/dashboard",
  organization: "/admin/organization",
  staff: "/admin/dashboard",
};

const MESSAGES: Partial<Record<MeKind, string>> = { trainee: "/trainee/messages", staff: "/admin/messages" };
const OPPORTUNITIES: Partial<Record<MeKind, string>> = { trainee: "/jobs", employer: "/employer/job-postings" };

export function parseLaunchTarget(value: string | null | undefined): LaunchTarget | null {
  return (LAUNCH_TARGETS as readonly string[]).includes(value ?? "") ? (value as LaunchTarget) : null;
}

export function launchDestination(me: MeKind | null, to: LaunchTarget | null): string {
  if (!me) return "/";
  if (to === "notifications") return "/notifications";
  if (to === "events") return me === "organization" ? "/admin/organization/events" : "/events";
  if (to === "messages") return MESSAGES[me] ?? HOME[me];
  if (to === "opportunities") return OPPORTUNITIES[me] ?? HOME[me];
  return HOME[me];
}
