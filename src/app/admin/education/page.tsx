import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgEducationManager from "@/components/ecosystem/OrgEducationManager";

export const metadata = { title: "Education videos" };

/** Organization-only: publish trainee educational videos and follow their status. */
export default async function OrganizationEducationPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Education videos" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Publish trainee education</h1>
      <p className="mt-1 text-sm text-gray-600">Share a YouTube video your trainee presented. The trainee is asked to agree before anything is shown publicly.</p>
      <div className="mt-6"><OrgEducationManager /></div>
    </main>
  );
}
