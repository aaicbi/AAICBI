import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
}

/**
 * Personalized landing page — an on-page summary of the SAME
 * `UserNotification` data the header bell (NotificationBell.tsx)
 * already shows, not a second notification system. Exists because the
 * spec explicitly asks for a visible summary on the landing page
 * itself, for anyone who wouldn't otherwise notice the header bell.
 */
export default function NotificationSummaryCard({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notifications</p>
        {unreadCount > 0 && <Badge variant="success">{unreadCount} New</Badge>}
      </div>
      {notifications.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">You&apos;re all caught up.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="border-b border-brand-gray pb-2 last:border-0 last:pb-0">
              {n.url ? (
                <Link href={n.url} className="block text-sm text-brand-ink hover:text-brand-teal">
                  {n.title}
                </Link>
              ) : (
                <p className="text-sm text-brand-ink">{n.title}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/notifications" className="mt-3 inline-block text-xs font-semibold text-brand-teal hover:underline">
        View All Notifications
      </Link>
    </Card>
  );
}
