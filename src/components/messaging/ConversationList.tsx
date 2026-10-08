"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Field";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import NewConversationModal from "@/components/messaging/NewConversationModal";
import { filterInbox, shortTime, sortInbox, type InboxRow } from "@/lib/messaging/inboxCore";

/**
 * The inbox for every kind of account: a search box, unread conversations
 * first, the time of the last message, an unread count, and "New chat". It
 * reads the one shared conversations API, which already limits each account
 * to the conversations it may see. The list refreshes when the person comes
 * back to the tab and every minute.
 */
export default function ConversationList({ basePath, emptyText }: { basePath: string; emptyText: string }) {
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  function load() {
    fetch("/api/conversations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: InboxRow[]) => {
        setRows(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
    };
  }, []);

  const shown = useMemo(() => (rows ? sortInbox(filterInbox(rows, query)) : []), [rows, query]);

  return (
    <>
      <div className="mt-4 flex items-end gap-3">
        <Input label="Search messages" hideLabel type="search" inputMode="search" wrapperClassName="flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people and messages" />
        <Button size="sm" onClick={() => setNewOpen(true)}>New chat</Button>
      </div>

      {failed && rows === null ? (
        <div className="mt-6"><ErrorState message="Could not load your messages." onRetry={load} /></div>
      ) : rows === null ? (
        <div className="mt-6"><SkeletonList rows={4} /></div>
      ) : rows.length === 0 ? (
        <div className="mt-6"><EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="No conversations yet" description={emptyText} /></div>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-600">Nothing matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((c) => (
            <li key={c.id}>
              <Link href={`${basePath}/${c.id}`} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                <Card interactive className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate text-brand-ink ${c.unreadCount > 0 ? "font-bold" : "font-semibold"}`}>{c.title}</p>
                    {c.subtitle && <p className="text-xs text-gray-600">{c.subtitle}</p>}
                    {c.lastMessage && <p className="mt-0.5 truncate text-sm text-gray-700">{c.lastMessage.body}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {c.lastMessage && <span className="text-xs text-gray-600">{shortTime(c.lastMessage.createdAt)}</span>}
                    {c.unreadCount > 0 && (
                      <Badge variant="gold">
                        {c.unreadCount}
                        <span className="sr-only"> unread</span>
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewConversationModal open={newOpen} onClose={() => setNewOpen(false)} redirectBase={basePath} />
    </>
  );
}
