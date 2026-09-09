import Link from "next/link";
import Card from "@/components/ui/Card";

interface ActivityEvent {
  id: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string | Date;
}

/**
 * Personalized landing page — covers both spec sections "Your
 * Activity"/"What's Happening" and "Since You Were Away" as ONE
 * section rather than two near-identical cards: for a returning
 * visitor these are the same question ("what changed since I was last
 * here?"), and a brand-new account has no "last visit" to speak of, so
 * it falls back to "recent activity" instead. Data is always the real
 * `UserNotification` rows already fetched by the calling page — see
 * src/lib/dashboard/recentNotifications.ts.
 */
export default function ActivityFeed({ mode, events }: { mode: "since-last-visit" | "recent"; events: ActivityEvent[] }) {
  const title = mode === "since-last-visit" ? "Since Your Last Visit" : "Your Activity";
  const emptyText =
    mode === "since-last-visit" ? "Nothing new since your last visit." : "Your recent activities will appear here.";

  return (
    <Card className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {events.map((e) => {
            const content = (
              <>
                <p className="text-sm font-medium text-brand-ink">{e.title}</p>
                <p className="text-xs text-gray-500">{e.body}</p>
              </>
            );
            return (
              <li key={e.id} className="border-b border-brand-gray pb-2 last:border-0 last:pb-0">
                {e.url ? (
                  <Link href={e.url} className="block hover:text-brand-teal">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
