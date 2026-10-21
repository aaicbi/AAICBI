import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventManager, { type Section } from "@/components/events/EventManager";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

/** A training organisation's Event Manager: its classes, live sessions, meetings and public activities, and its requests for public promotion. */
export default async function OrganizationEventsPage({ searchParams }: { searchParams: { section?: string } }) {
  const a = await managerPage("organization");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Events" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Events and live sessions</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">Schedule classes, live sessions, meetings and public activities for your trainees and staff. Ask AAICBI to promote a public event; it is only advertised after AAICBI approves it.</p>
      <div className="mt-6"><EventManager scope="organization" apiBase="/api/org/events" uiBase="/admin/organization/events" section={(searchParams.section as Section) ?? "all"} permissions={[...a.permissions]} /></div>
    </main>
  );
}
