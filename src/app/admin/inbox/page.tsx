"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface InboxMessage {
  id: string;
  senderType: "TRAINEE" | "STAFF" | "EMPLOYER";
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const SENDER_LABEL: Record<InboxMessage["senderType"], string> = {
  TRAINEE: "Trainee",
  STAFF: "Staff",
  EMPLOYER: "Employer",
};

/**
 * /admin/inbox — the receiving side of the simple direct inbox, the
 * reverse of Loop's own outbound broadcast messaging. SUPER_ADMIN
 * only, same access-denied pattern as /admin/command. A shared team
 * inbox, not a per-admin one — see SuperAdminMessage's own schema
 * comment for why read state isn't tracked per-viewer. No reply
 * feature here on purpose: the sender's real email is shown precisely
 * so a Super Admin can reply the normal way, outside the app.
 */
export default function AdminInboxPage() {
  const [role, setRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRole(typeof data.role === "string" ? data.role : null))
      .catch(() => setRole(null))
      .finally(() => setRoleChecked(true));
  }, []);

  function load() {
    fetch("/api/admin/inbox")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setMessages(data.messages))
      .catch(() => setMessages([]));
  }

  useEffect(() => {
    if (role === "SUPER_ADMIN") load();
  }, [role]);

  async function markRead(id: string) {
    await fetch(`/api/admin/inbox/${id}/read`, { method: "POST" });
    setMessages((prev) => (prev ? prev.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m)) : prev));
  }

  const nav = [
    { label: "Examinations", href: "/admin/dashboard" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Command", href: "/admin/command" },
    { label: "Settings", href: "/admin/settings" },
  ];

  if (roleChecked && role !== "SUPER_ADMIN") {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Inbox</p>
            <p className="mt-2 text-sm text-gray-600">Only Super Admins can view the admin inbox.</p>
          </Card>
        </main>
      </>
    );
  }

  const unreadCount = messages?.filter((m) => !m.readAt).length ?? 0;

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Inbox</h1>
            <p className="mt-1 text-sm text-gray-500">
              Direct messages sent to you by trainees, employers, and staff.
            </p>
          </div>
          {unreadCount > 0 && <Badge variant="success">{unreadCount} unread</Badge>}
        </div>

        <div className="mt-6 space-y-3">
          {messages === null && <p className="text-sm text-gray-400">Loading…</p>}
          {messages?.length === 0 && <EmptyState title="No messages" description="Nothing here yet." />}
          {messages?.map((m) => (
            <Card key={m.id} className={!m.readAt ? "bg-brand-mint/20" : ""}>
              <button onClick={() => !m.readAt && markRead(m.id)} className="block w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{SENDER_LABEL[m.senderType]}</Badge>
                      <p className="text-sm font-semibold text-brand-ink">{m.senderName}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{m.senderEmail}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-brand-ink">{m.subject}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{m.body}</p>
              </button>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
