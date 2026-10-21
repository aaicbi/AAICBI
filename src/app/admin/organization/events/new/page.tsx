import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventForm from "@/components/events/EventForm";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Create an event" };
export const dynamic = "force-dynamic";

export default async function NewOrganizationEventPage() {
  const a = await managerPage("organization", "org_events.events:create");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Events", href: "/admin/organization/events" }, { label: "Create event" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Create an event</h1>
      <div className="mt-6"><EventForm scope="organization" apiBase="/api/org/events" uiBase="/admin/organization/events" initial={null} orgName={a.orgName} canSubmitPromotion={a.permissions.has("org_events.promotion:create")} canPublish={false} canUpload={a.permissions.has("org_events.media:manage")} /></div>
    </main>
  );
}
