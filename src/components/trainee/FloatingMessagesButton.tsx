"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import Icon from "@/components/ui/Icon";

interface ConversationRow {
  unreadCount: number;
}

/**
 * A persistent, trainee-wide shortcut to Messages — fixed bottom-right
 * on every authenticated trainee page, mounted once in
 * src/app/trainee/layout.tsx (same "mount once, pathname decides
 * visibility" pattern as TourGuideButton.tsx). Bottom-right is free on
 * every trainee page now — TourGuideButton already suppresses itself
 * there in favor of the sidebar's own "Page Help" trigger (see
 * sidebarRoutes.ts).
 *
 * Hidden specifically on the two live exam/assessment-taking screens
 * (not their instructions or result pages) — same "don't distract
 * during a timed, focus-sensitive screen" convention this app already
 * applies elsewhere (see Logo.tsx's own comment on its `href` prop for
 * the live exam-taking page).
 *
 * Polls /api/conversations every 60s for the same reason
 * NotificationBell does (see its own comment) — this app has no
 * real-time infrastructure, and a badge a minute stale is a fine
 * trade-off. That endpoint already returns a per-conversation
 * unreadCount (src/app/trainee/messages/page.tsx uses it the same
 * way); this just sums them for one total badge.
 */
export default function FloatingMessagesButton() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    function load() {
      fetch("/api/conversations")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((rows: ConversationRow[]) => {
          setUnreadCount(rows.reduce((sum, row) => sum + row.unreadCount, 0));
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const isLiveExamOrAssessment = pathname?.endsWith("/examination/take") || pathname?.endsWith("/assessment/take");
  if (isLiveExamOrAssessment) return null;

  return (
    <Link
      href="/trainee/messages"
      aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-tealDeep"
    >
      <Icon icon={MessageSquare} size="md" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-rose px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
