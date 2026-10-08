"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import ConversationThread from "@/components/messaging/ConversationThread";
import { EMPLOYER_NAV } from "@/lib/employer/nav";

export default function EmployerConversationPage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={EMPLOYER_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <BackLink href="/employer/messages" className="text-sm text-brand-teal hover:underline">
          Back to Messages
        </BackLink>
        <ConversationThread conversationId={params.id} />
      </main>
    </>
  );
}
