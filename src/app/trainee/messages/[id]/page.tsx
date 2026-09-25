"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import BackLink from "@/components/ui/BackLink";
import ConversationThread from "@/components/messaging/ConversationThread";

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "My Downloads", href: "/trainee/downloads" },
  { label: "Introductions", href: "/trainee/introductions" },
  { label: "Job Board", href: "/trainee/job-postings" },
  { label: "Ask Loop", href: "/trainee/buddy" },
  { label: "Messages", href: "/trainee/messages" },
  { label: "My Profile", href: "/trainee/profile" },
  { label: "Settings", href: "/trainee/settings" },
];

export default function TraineeConversationPage({ params }: { params: { id: string } }) {
  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <BackLink href="/trainee/messages" className="text-sm text-brand-teal hover:underline">
          Back to Messages
        </BackLink>
        <ConversationThread conversationId={params.id} />
      </main>
    </>
  );
}
