import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventManage from "@/components/events/EventManage";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Event" };
export const dynamic = "force-dynamic";

export default async function PlatformEventPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const a = await managerPage("platform");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Event Manager", href: "/admin/events" }, { label: "Event" }]} />
      <div className="mt-3"><EventManage scope="platform" apiBase="/api/admin/events" uiBase="/admin/events" eventId={params.id} permissions={[...a.permissions]} initialTab={searchParams.tab} /></div>
    </main>
  );
}
