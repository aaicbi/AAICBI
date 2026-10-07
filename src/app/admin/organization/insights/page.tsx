import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgInsights from "@/components/ecosystem/OrgInsights";

export const metadata = { title: "Content and visibility" };

/** Organization-only: how its public page, videos and programs are doing. */
export default async function OrganizationInsightsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Content and visibility" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Content and visibility</h1>
      <p className="mt-1 text-sm text-gray-600">Who is finding you and what they do next. Numbers are anonymous counts; nobody is identified.</p>
      <div className="mt-6"><OrgInsights /></div>
    </main>
  );
}
