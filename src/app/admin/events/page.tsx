import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventManager, { type Section } from "@/components/events/EventManager";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Event Manager" };
export const dynamic = "force-dynamic";

/** AAICBI's Event Manager: platform events, the global calendar and organizations' promotion requests. Only staff holding an event permission get in. */
export default async function AdminEventsPage({ searchParams }: { searchParams: { section?: string } }) {
  const a = await managerPage("platform");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Event Manager" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Event Manager</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">Schedule AAICBI events and live sessions, publish them to the whole ecosystem, and review training organisations&apos; requests to have their events promoted.</p>
      <div className="mt-6"><EventManager scope="platform" apiBase="/api/admin/events" uiBase="/admin/events" section={(searchParams.section as Section) ?? "overview"} permissions={[...a.permissions]} /></div>
    </main>
  );
}
