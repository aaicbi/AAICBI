"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

interface NotificationDto {
  id: string;
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
              <button onClick={() => handleClick(n)} className="block w-full text-left">
                {n.senderLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-tealDeep">{n.senderLabel}</p>
                )}
                <p className="text-sm font-semibold text-brand-ink">{n.title}</p>
                <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                <p className="mt-1.5 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
