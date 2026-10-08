"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { shortTime, type InboxRow } from "@/lib/messaging/inboxCore";

/** The unread conversations, newest first, for the phone home. Reads the same inbox API as the Messages page. */
export default function MobileMessagesPreview({ href }: { href: string }) {
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/conversations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: InboxRow[]) => live && setRows(d))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);
  const unread = (rows ?? []).filter((r) => r.unreadCount > 0).sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? "0") - Date.parse(a.lastMessage?.createdAt ?? "0")).slice(0, 3);
  return (
    <div>
      {rows === null && <p className="text-sm text-gray-600">Loading…</p>}
      {rows !== null && unread.length === 0 && <p className="text-sm text-gray-700">You&apos;re all caught up.</p>}
      <ul className="space-y-1">
        {unread.map((r) => (
          <li key={r.id}>
            <Link href={`${href}/${r.id}`} className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg px-1 hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-brand-ink">{r.title}</span>
                {r.lastMessage && <span className="block truncate text-xs text-gray-600">{r.unreadCount} unread · {shortTime(r.lastMessage.createdAt)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
