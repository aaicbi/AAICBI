import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventManage from "@/components/events/EventManage";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Event" };
export const dynamic = "force-dynamic";

export default async function OrganizationEventPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const a = await managerPage("organization");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Events", href: "/admin/organization/events" }, { label: "Event" }]} />
      <div className="mt-3"><EventManage scope="organization" apiBase="/api/org/events" uiBase="/admin/organization/events" eventId={params.id} permissions={[...a.permissions]} initialTab={searchParams.tab} /></div>
    </main>
  );
}
