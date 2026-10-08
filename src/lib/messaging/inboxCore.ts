/** Pure helpers for the inbox list: filtering by a search, and a short time label. */
export interface InboxRow {
  id: string;
  type: "DIRECT" | "COHORT";
  title: string;
  subtitle: string | null;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
}

export function filterInbox(rows: InboxRow[], query: string): InboxRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.title.toLowerCase().includes(q) || (r.subtitle ?? "").toLowerCase().includes(q) || (r.lastMessage?.body ?? "").toLowerCase().includes(q));
}

/** "now", "12m", "3h", "Yesterday", or a short date: what chat apps show beside the last message. */
export function shortTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "";
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24 && then.getDate() === now.getDate()) return `${hours}h`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (then.getTime() >= startOfToday - 24 * 3600 * 1000 && then.getTime() < startOfToday) return "Yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Unread conversations first, then most recent, so what needs a reply is at the top. */
export function sortInbox(rows: InboxRow[]): InboxRow[] {
  return [...rows].sort((a, b) => {
    if ((a.unreadCount > 0) !== (b.unreadCount > 0)) return a.unreadCount > 0 ? -1 : 1;
    const at = a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0;
    const bt = b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0;
    return bt - at;
  });
}
