import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgEventsManager from "@/components/ecosystem/OrgEventsManager";

export const metadata = { title: "Events" };

/** Organization-only: events shown on the public page and in /events. */
export default async function OrganizationEventsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Events" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Events</h1>
      <p className="mt-1 text-sm text-gray-600">Open days, workshops and demo days. Visitors register on your own link; nothing is collected here.</p>
      <div className="mt-6"><OrgEventsManager /></div>
    </main>
  );
}
