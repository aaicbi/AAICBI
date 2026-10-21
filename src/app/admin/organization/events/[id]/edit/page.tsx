import { notFound, redirect } from "next/navigation";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventForm from "@/components/events/EventForm";
import { manageDetail } from "@/lib/events/events";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EditOrganizationEventPage({ params }: { params: { id: string } }) {
  const a = await managerPage("organization");
  const d = await manageDetail(a, params.id).catch(() => null);
  if (!d) notFound();
  if (!d.rights.edit) redirect(`/admin/organization/events/${params.id}`);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Events", href: "/admin/organization/events" }, { label: d.event.title, href: `/admin/organization/events/${params.id}` }, { label: "Edit" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Edit event</h1>
      <div className="mt-6"><EventForm scope="organization" apiBase="/api/org/events" uiBase="/admin/organization/events" eventId={params.id} initial={d} orgName={a.orgName} canSubmitPromotion={a.permissions.has("org_events.promotion:create")} canPublish={false} canUpload={a.permissions.has("org_events.media:manage")} hasPasscode={d.join?.hasPasscode} /></div>
    </main>
  );
}
