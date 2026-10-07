import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgPublicProfileForm from "@/components/ecosystem/OrgPublicProfileForm";

export const metadata = { title: "Public profile" };

/** Organization-only: edit the public page visitors see at /organizations/[address]. */
export default async function OrganizationProfilePage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Public profile" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Public profile</h1>
      <p className="mt-1 text-sm text-gray-600">What visitors see on your organization page. Only the fields below are ever shown publicly.</p>
      <div className="mt-6"><OrgPublicProfileForm /></div>
    </main>
  );
}
