import type { MeKind } from "@/lib/guide/context";

/**
 * Where the installed app opens. The manifest's start_url is a single
 * address (/app). Opening the app always lands on the feed ("/"), for
 * everyone, signed in or not; each account reaches its own dashboard from
 * the feed's Dashboard button. A shortcut such as "Messages" adds
 * ?to=messages and lands on that role's own messages page when it has
 * one, and on the feed otherwise.
 */
export type LaunchTarget = "messages" | "events" | "notifications" | "opportunities";
export const LAUNCH_TARGETS: readonly LaunchTarget[] = ["messages", "events", "notifications", "opportunities"];

const MESSAGES: Partial<Record<MeKind, string>> = { trainee: "/trainee/messages", employer: "/employer/messages", organization: "/admin/messages", staff: "/admin/messages" };
const OPPORTUNITIES: Partial<Record<MeKind, string>> = { trainee: "/jobs", employer: "/employer/job-postings" };

export function parseLaunchTarget(value: string | null | undefined): LaunchTarget | null {
  return (LAUNCH_TARGETS as readonly string[]).includes(value ?? "") ? (value as LaunchTarget) : null;
}

export function launchDestination(me: MeKind | null, to: LaunchTarget | null): string {
  if (!me) return "/";
  if (to === "notifications") return "/notifications";
  if (to === "events") return me === "organization" ? "/admin/organization/events" : "/events";
  if (to === "messages") return MESSAGES[me] ?? "/";
  if (to === "opportunities") return OPPORTUNITIES[me] ?? "/";
  return "/";
}
