"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import { MessageCircle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import ConversationList from "@/components/messaging/ConversationList";
import { EMPLOYER_NAV } from "@/lib/employer/nav";

export default function EmployerMessagesPage() {
  return (
    <>
      <SiteHeader nav={EMPLOYER_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={MessageCircle} size="lg" /> Messages
        </h1>
        <p className="mt-1 text-sm text-gray-600">Chat with trainees who accepted your introduction or applied to your jobs, and with the Super Admin for support.</p>
        <ConversationList basePath="/employer/messages" emptyText="Once a trainee accepts your introduction or applies to one of your jobs, you can message them here." />
      </main>
    </>
  );
}
