"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import ConversationThread from "@/components/messaging/ConversationThread";
import { TRAINEE_NAV } from "@/lib/trainee/nav";

export default function TraineeConversationPage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <BackLink href="/trainee/messages" className="text-sm text-brand-teal hover:underline">
          Back to Messages
        </BackLink>
        <ConversationThread conversationId={params.id} />
      </main>
    </>
  );
}
