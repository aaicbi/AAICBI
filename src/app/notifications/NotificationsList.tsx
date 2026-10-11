"use client";
import Clamp from "@/components/ui/Clamp";
import { useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import { notificationIconFor } from "@/lib/notifications/typeIcons";

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
  senderLabel: string | null;
}

/** Same mark-read/mark-all-read calls as NotificationBell.tsx, applied to a full list instead of a dropdown. */
export default function NotificationsList({ initialNotifications }: { initialNotifications: NotificationDto[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  function handleClick(n: NotificationDto) {
    if (!n.readAt) markRead(n.id);
    if (n.url) window.location.href = n.url;
  }

  return (
    <>
      {unreadCount > 0 && (
        <div className="mt-4 flex justify-end">
          <button onClick={markAllRead} className="text-xs font-semibold text-brand-teal hover:underline">
            Mark all as read
          </button>
        </div>
      )}
      <div className="mt-2 space-y-2">
        {notifications.length === 0 ? (
          <EmptyState title="No notifications" description="You're all caught up." />
        ) : (
          notifications.map((n) => (
            <Card key={n.id} interactive className={!n.readAt ? "bg-brand-mint/20" : ""}>
              {/* The card opens the notification from its title (a real button, so keyboards work) or by tapping the text; "See more" is a separate control and never opens it. */}
              <div className="flex w-full items-start gap-3 text-left" onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) handleClick(n); }}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-mint text-brand-teal">
                  <Icon icon={notificationIconFor(n.type)} size="sm" />
                </span>
                <div className="min-w-0 flex-1 cursor-pointer">
                  <button type="button" onClick={() => handleClick(n)} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                    {n.senderLabel && (
                      <span className="block text-xs font-bold uppercase tracking-wide text-brand-tealDeep">{n.senderLabel}</span>
                    )}
                    <span className="block break-words [overflow-wrap:anywhere] text-sm font-semibold text-brand-ink">{n.title}</span>
                  </button>
                  <Clamp lines={3} className="mt-1 text-sm text-gray-600"><p className="whitespace-pre-line">{n.body}</p></Clamp>
                  <p className="mt-1.5 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
