import Link from "next/link";
import Card from "@/components/ui/Card";
import type { EventCard } from "@/lib/ecosystem/events";
import { formatWhen } from "@/lib/events/eventsCore";

/** Short event entries for the public pages. Each opens the full event page, where registration and the join button are. Times show their zone. */
export default function EventList({ events, showOrganization = false }: { events: EventCard[]; showOrganization?: boolean }) {
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id}>
          <Card interactive>
            <p className="font-display font-semibold text-brand-ink"><Link href={`/events/${e.id}`} className="hover:underline">{e.title}</Link></p>
            <p className="text-xs text-gray-600">
              {formatWhen(e.startsAt, e.endsAt ?? e.startsAt, e.timeZone)}{e.locationText ? ` • ${e.locationText}` : ""}
              {showOrganization && e.organizationSlug && <> • <Link href={`/organizations/${e.organizationSlug}`} className="text-brand-teal underline underline-offset-2 hover:no-underline">{e.organizationName}</Link></>}
              {showOrganization && !e.organizationSlug && <> • {e.organizationName}</>}
            </p>
            {e.description && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-gray-700">{e.description}</p>}
            <p className="mt-2"><Link href={`/events/${e.id}`} className="text-sm font-semibold text-brand-teal hover:underline">View details</Link></p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
