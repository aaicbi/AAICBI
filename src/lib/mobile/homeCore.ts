/**
 * The phone home screen: a short stack of cards in the order that matters
 * most to each kind of account, instead of the full dashboard. Pure types
 * and ordering, so the priorities live in one tested place. Blocks with
 * nothing to show are simply not built, so the stack stays short.
 */
export type HomeRole = "trainee" | "employer" | "organization";

export interface Stat {
  label: string;
  value: string | number;
  href?: string;
}

export type MobileBlock =
  | { kind: "welcome"; greeting: string; name: string; line: string | null }
  | { kind: "alerts"; unread: number; items: Array<{ title: string; href: string }> }
  | { kind: "event"; title: string; when: string; where: string | null; by: string; href: string }
  | { kind: "course"; title: string; percent: number; detail: string; href: string }
  | { kind: "assessment"; title: string; status: string; href: string }
  | { kind: "messages"; href: string }
  | { kind: "opportunities"; items: Array<{ title: string; by: string; href: string }>; seeAllHref: string }
  | { kind: "talent"; text: string; label: string; href: string }
  | { kind: "applications"; count: number; href: string }
  | { kind: "trainees"; stats: Stat[]; href: string }
  | { kind: "training"; stats: Stat[]; href: string }
  | { kind: "actions"; items: Array<{ label: string; href: string }> };

export type BlockKind = MobileBlock["kind"];

/** Most important first, per account. A kind not listed for a role is never shown to it. */
export const HOME_ORDER: Record<HomeRole, BlockKind[]> = {
  trainee: ["welcome", "alerts", "event", "course", "assessment", "messages", "opportunities", "actions"],
  employer: ["welcome", "alerts", "messages", "talent", "applications", "event", "opportunities", "actions"],
  organization: ["welcome", "alerts", "trainees", "messages", "event", "training", "actions"],
};

export function orderBlocks(role: HomeRole, blocks: MobileBlock[]): MobileBlock[] {
  const order = HOME_ORDER[role];
  return blocks
    .filter((b) => order.includes(b.kind))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** An event time, always in UTC and said so, because events are published in UTC. */
export function eventWhen(startsAt: Date): string {
  const text = startsAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
  return `${text} UTC`;
}
