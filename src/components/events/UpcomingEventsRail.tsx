import Link from "next/link";
import { CalendarDays } from "lucide-react";
import EventCard from "@/components/events/EventCard";
import { listVisibleEvents } from "@/lib/events/events";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * The next few events on the ecosystem feed: one row of cards that scrolls sideways, so events are easy to notice without pushing posts far
 * down the page. Shows only what this person may see (a visitor sees published public events). Draws nothing when there is none.
 */
export default async function UpcomingEventsRail({ session }: { session: SessionPayload | null }) {
  const list = await listVisibleEvents(session, { take: 5, when: "upcoming" }).catch(() => null);
  if (!list || list.items.length === 0) return null;
  return (
    <section aria-label="Upcoming events" className="mt-4" data-testid="events-rail">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-ink"><CalendarDays className="h-5 w-5 text-brand-teal" aria-hidden="true" /> Upcoming events</h2>
        <Link href="/events" className="text-sm font-semibold text-brand-teal hover:underline">All events</Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {list.items.map((e, i) => <li key={e.id} className="w-[270px] shrink-0 snap-start sm:w-[290px]"><EventCard event={e} mine={e.myRegistration} priority={i === 0} /></li>)}
      </ul>
    </section>
  );
}
