import { notFound, redirect } from "next/navigation";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EventForm from "@/components/events/EventForm";
import { manageDetail } from "@/lib/events/events";
import { managerPage } from "@/lib/events/pageAuth";

export const metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

export default async function EditPlatformEventPage({ params }: { params: { id: string } }) {
  const a = await managerPage("platform");
  const d = await manageDetail(a, params.id).catch(() => null);
  if (!d) notFound();
  if (!d.rights.edit) redirect(`/admin/events/${params.id}`);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Event Manager", href: "/admin/events" }, { label: d.event.title, href: `/admin/events/${params.id}` }, { label: "Edit" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Edit event</h1>
      <div className="mt-6"><EventForm scope="platform" apiBase="/api/admin/events" uiBase="/admin/events" eventId={params.id} initial={d} canSubmitPromotion={false} canPublish={a.permissions.has("events.platform:publish")} canUpload hasPasscode={d.join?.hasPasscode} /></div>
    </main>
  );
}
