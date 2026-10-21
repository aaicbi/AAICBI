import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventForm from "@/components/events/EventForm";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Create an event" };
export const dynamic = "force-dynamic";

export default async function NewPlatformEventPage() {
  const a = await managerPage("platform", "events.platform:create");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Event Manager", href: "/admin/events" }, { label: "Create event" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Create an event</h1>
      <div className="mt-6"><EventForm scope="platform" apiBase="/api/admin/events" uiBase="/admin/events" initial={null} canSubmitPromotion={false} canPublish={a.permissions.has("events.platform:publish")} canUpload /></div>
    </main>
  );
}
