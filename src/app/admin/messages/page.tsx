"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { MessageCircle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import NewConversationModal from "@/components/messaging/NewConversationModal";

interface ConversationRow {
  id: string;
  type: "DIRECT" | "COHORT";
  title: string;
  subtitle: string | null;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
}

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Payments", href: "/admin/payments" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

/**
 * The shared team inbox. SUPER_ADMIN sees every conversation platform-
 * wide (full oversight, confirmed scope decision); ADMIN/INSTRUCTOR see
 * only their own cohorts' chats and their own DMs — GET /api/
 * conversations already applies that scoping, this page just renders
 * whatever it returns.
 */
export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  function load() {
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setConversations)
      .catch(() => setConversations([]));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
              <Icon icon={MessageCircle} size="lg" /> Messages
            </h1>
            <p className="mt-1 text-sm text-gray-500">Trainee DMs and cohort group chats.</p>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            New chat
          </Button>
        </div>

        {conversations === null ? (
          <div className="mt-6">
            <SkeletonList rows={4} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="mt-6">
            <EmptyState illustration={<GrowthPathDoodle className="h-full w-full" />} title="No conversations yet" description="Message a trainee from the Performance dashboard, or start a chat here." />
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {conversations.map((c) => (
              <Link key={c.id} href={`/admin/messages/${c.id}`}>
                <Card interactive className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-ink">{c.title}</p>
                    {c.subtitle && <p className="text-xs text-gray-500">{c.subtitle}</p>}
                    {c.lastMessage && <p className="mt-0.5 truncate text-sm text-gray-600">{c.lastMessage.body}</p>}
                  </div>
                  {c.unreadCount > 0 && <Badge variant="gold">{c.unreadCount}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <NewConversationModal open={newOpen} onClose={() => setNewOpen(false)} redirectBase="/admin/messages" />
    </>
  );
}
