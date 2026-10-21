import Link from "next/link";
import type { Metadata } from "next";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import EmptyState from "@/components/ui/EmptyState";
import EventCard from "@/components/events/EventCard";
import { Input, Select } from "@/components/ui/Field";
import { getSession } from "@/lib/auth/session";
import { getEventSettings } from "@/lib/events/eventsAccess";
import { listCategories, listVisibleEvents, publicOrganizers, type Filters } from "@/lib/events/events";
import { DELIVERIES, DELIVERY_LABEL, EVENT_TYPES } from "@/lib/events/eventsCore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events", description: "Live sessions, workshops, webinars, classes and public lectures across the AAICBI Ecosystem." };

type SP = Record<string, string | undefined>;
const WHEN = [["upcoming", "Upcoming"], ["live", "Live now"], ["past", "Past"]] as const;

/** /events: every event the person may see, with search and filters. Visitors see only published public events. */
export default async function EventsPage({ searchParams }: { searchParams: SP }) {
  const [settings, session] = await Promise.all([getEventSettings(), getSession()]);
  const when = (["upcoming", "live", "past"].includes(searchParams.when ?? "") ? searchParams.when : "upcoming") as Filters["when"];
  const f: Filters = { q: searchParams.q, categoryId: searchParams.category, delivery: searchParams.delivery, organizer: searchParams.organizer, type: searchParams.type, audience: searchParams.audience, when, from: searchParams.from ? `${searchParams.from}T00:00:00Z` : undefined, to: searchParams.to ? `${searchParams.to}T23:59:59Z` : undefined, page: Number(searchParams.page) || 1, take: 12 };
  const [list, categories, organizers] = settings.enabled ? await Promise.all([listVisibleEvents(session, f), listCategories(true), publicOrganizers()]) : [{ items: [], total: 0, page: 1, pageSize: 12 }, [], []];
  const link = (patch: SP) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) p.set(k, v); return `/events?${p.toString()}`; };
  const pages = Math.ceil(list.total / list.pageSize);
  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Events</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">Live sessions, workshops, webinars, classes and public lectures. {session ? "You also see events your organisations and courses have scheduled for you." : "Sign in to see events meant for your courses and organisation."}</p>
        {!settings.enabled ? <div className="mt-6"><EmptyState title="Events are switched off" description="Check back soon." /></div> : (
          <>
            <nav aria-label="When" className="mt-5 flex gap-1">
              {WHEN.filter(([k]) => settings.showPast || k !== "past").map(([k, l]) => <Link key={k} href={link({ when: k, page: undefined })} aria-current={when === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold ${when === k ? "border-brand-teal bg-brand-mint text-brand-ink" : "border-brand-gray text-gray-700 hover:bg-brand-mint/50"}`}>{l}</Link>)}
            </nav>
            <form method="get" action="/events" className="mt-4 grid gap-3 rounded-2xl border border-brand-gray bg-brand-surface p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filter events">
              <input type="hidden" name="when" value={when} />
              <Input label="Search" name="q" defaultValue={searchParams.q ?? ""} placeholder="Title or keyword" compact />
              <Select label="Category" name="category" defaultValue={searchParams.category ?? ""} compact><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Select label="Kind" name="type" defaultValue={searchParams.type ?? ""} compact><option value="">Any kind</option>{EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
              <Select label="How" name="delivery" defaultValue={searchParams.delivery ?? ""} compact><option value="">Online or in person</option>{DELIVERIES.map((d) => <option key={d} value={d}>{DELIVERY_LABEL[d]}</option>)}</Select>
              <Select label="Organiser" name="organizer" defaultValue={searchParams.organizer ?? ""} compact><option value="">Everyone</option><option value="platform">AAICBI</option>{organizers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
              <Input label="From" type="date" name="from" defaultValue={searchParams.from ?? ""} compact />
              <Input label="To" type="date" name="to" defaultValue={searchParams.to ?? ""} compact />
              {session ? <Select label="Show" name="audience" defaultValue={searchParams.audience ?? ""} compact><option value="">Everything I can see</option><option value="PUBLIC">Public events</option><option value="RESTRICTED">Organisation and course events</option></Select> : <div />}
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4"><button type="submit" className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">Apply filters</button><Link href={`/events?when=${when}`} className="flex min-h-[44px] items-center px-3 text-sm font-semibold text-brand-teal hover:underline">Clear</Link></div>
            </form>
            <div className="mt-6">
              {list.items.length === 0 ? <EmptyState title={when === "live" ? "Nothing is live right now" : when === "past" ? "No past events match" : "No upcoming events match"} description="Try different filters, or check back soon." /> : (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="events-grid">
                  {list.items.map((e, i) => <li key={e.id}><EventCard event={e} mine={e.myRegistration} priority={i < 3} /></li>)}
                </ul>
              )}
            </div>
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
                {list.page > 1 && <Link href={link({ page: String(list.page - 1) })} className="font-semibold text-brand-teal hover:underline">Previous</Link>}
                <span className="text-gray-700">Page {list.page} of {pages}</span>
                {list.page < pages && <Link href={link({ page: String(list.page + 1) })} className="font-semibold text-brand-teal hover:underline">Next</Link>}
              </nav>
            )}
          </>
        )}
        <p className="mt-8 text-sm"><Link href="/search" className="font-semibold text-brand-teal hover:underline">Search everything</Link></p>
      </main>
    </>
  );
}
