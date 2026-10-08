"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import { MessageCircle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import ConversationList from "@/components/messaging/ConversationList";
import { TRAINEE_NAV } from "@/lib/trainee/nav";

export default function TraineeMessagesPage() {
  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={MessageCircle} size="lg" /> Messages
        </h1>
        <p className="mt-1 text-sm text-gray-600">Chat with your cohort, your instructors, and employers you have connected with.</p>
        <ConversationList basePath="/trainee/messages" emptyText="Start a chat with a cohort-mate, a staff member, or an employer you have connected with." />
      </main>
    </>
  );
}
