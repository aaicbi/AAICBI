"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import { MessageCircle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import ConversationList from "@/components/messaging/ConversationList";
import { ADMIN_NAV } from "@/lib/admin/nav";

/**
 * The shared team inbox. SUPER_ADMIN sees every conversation platform-wide
 * (full oversight); ADMIN, INSTRUCTOR and training organizations see only
 * their own cohorts' chats and their own DMs: GET /api/conversations already
 * applies that scoping, and this page renders whatever it returns.
 */
export default function AdminMessagesPage() {
  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={MessageCircle} size="lg" /> Messages
        </h1>
        <p className="mt-1 text-sm text-gray-600">Trainee DMs and cohort group chats.</p>
        <ConversationList basePath="/admin/messages" emptyText="Message a trainee from the Performance dashboard, or start a chat here." />
      </main>
    </>
  );
}
