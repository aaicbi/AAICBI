"use client";
import { useEffect, useRef, useState } from "react";

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * The real, always-visible notification bell behind "notifications
 * should always be active like in every social media" — a single,
 * role-agnostic component rather than one built per account type,
 * since the API it calls (/api/notifications) already resolves the
 * caller's role from their session. Rendered from each of the three
 * LogoutButton components (trainee/admin/employer) rather than added
 * to dozens of individual pages — every one of those already renders
 * on every page in the app, so the bell inherits that same reach for
 * free.
 *
 * Polls every 60 seconds rather than holding a persistent connection
 * (WebSocket/SSE) — this project has no real-time infrastructure
 * anywhere else, and a new architectural layer just for this would be
 * a genuinely disproportionate addition; a minute of staleness on a
 * notification badge is a real but minor trade-off, not a broken
 * experience.
 */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function load() {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  function handleClick(n: NotificationDto) {
    if (!n.readAt) markRead(n.id);
    if (n.url) window.location.href = n.url;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint hover:text-brand-teal"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-rose px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Audit finding, closed here: same hardcoded-`bg-white` gap as
        // Card's own — see that component's comment for the full
        // reasoning.
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] rounded-xl border border-brand-gray bg-brand-surface shadow-lg animate-[modal-in_0.15s_ease-out]">
          <div className="flex items-center justify-between border-b border-brand-gray px-4 py-3">
            <p className="text-sm font-semibold text-brand-ink">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-brand-teal hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`block w-full border-b border-brand-gray px-4 py-3 text-left last:border-0 hover:bg-brand-mint/40 ${!n.readAt ? "bg-brand-mint/20" : ""}`}
                >
                  <p className="text-sm font-semibold text-brand-ink">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{n.body}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
