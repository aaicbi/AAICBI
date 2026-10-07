import Link from "next/link";
import Card from "@/components/ui/Card";
import type { EventCard } from "@/lib/ecosystem/events";

const fmt = (d: Date) => d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** Event cards. The registration link is the organization's own and is always opened as an external link. */
export default function EventList({ events, showOrganization = false }: { events: EventCard[]; showOrganization?: boolean }) {
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id}>
          <Card>
            <p className="font-display font-semibold text-brand-ink">{e.title}</p>
            <p className="text-xs text-gray-600">
              {fmt(e.startsAt)}{e.endsAt ? ` to ${fmt(e.endsAt)}` : ""}{e.locationText ? ` • ${e.locationText}` : ""}
              {showOrganization && e.organizationSlug && <> • <Link href={`/organizations/${e.organizationSlug}`} className="text-brand-teal underline underline-offset-2 hover:no-underline">{e.organizationName}</Link></>}
            </p>
            {e.description && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{e.description}</p>}
            {e.registrationUrl && (
              <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-sm font-semibold text-brand-teal hover:underline">Register</a>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
