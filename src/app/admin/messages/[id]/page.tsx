"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import ConversationThread from "@/components/messaging/ConversationThread";
import { ADMIN_NAV } from "@/lib/admin/nav";

export default function AdminConversationPage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <BackLink href="/admin/messages" className="text-sm text-brand-teal hover:underline">
          Back to Messages
        </BackLink>
        <ConversationThread conversationId={params.id} />
      </main>
    </>
  );
}
