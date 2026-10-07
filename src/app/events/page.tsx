import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import EventList from "@/components/ecosystem/EventList";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { listUpcomingEvents } from "@/lib/ecosystem/events";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Events", description: "Open days, workshops and demo days from training organizations." };

/** /events — upcoming events from organizations with a public page. */
export default async function EventsPage() {
  const flags = await getEcosystemFlags();
  if (!flags.orgPages) notFound();
  const events = await listUpcomingEvents({ take: 60 });
  return (
    <>
      <SiteHeader nav={[{ label: "Learn", href: "/learn" }, { label: "Organizations", href: "/organizations" }]} />
      <EcosystemSubnav active="events" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Upcoming events</h1>
        <p className="mt-1 text-sm text-gray-600">Open days, workshops and demo days. Registration happens on the organization&apos;s own link.</p>
        <div className="mt-6">
          {events.length === 0 ? <EmptyState title="No upcoming events" description="Check back soon." /> : <EventList events={events} showOrganization />}
        </div>
        <p className="mt-6 text-sm"><Link href="/search" className="font-semibold text-brand-teal hover:underline">Search everything</Link></p>
      </main>
    </>
  );
}
