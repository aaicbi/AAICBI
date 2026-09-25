"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import ConversationThread from "@/components/messaging/ConversationThread";

const NAV = [
  { label: "Examinations", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Performance", href: "/admin/performance" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Payments", href: "/admin/payments" },
  { label: "My Profile", href: "/admin/profile" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminConversationPage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <BackLink href="/admin/messages" className="text-sm text-brand-teal hover:underline">
          Back to Messages
        </BackLink>
        <ConversationThread conversationId={params.id} />
      </main>
    </>
  );
}
