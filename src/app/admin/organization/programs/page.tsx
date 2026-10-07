import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgProgramSkills from "@/components/ecosystem/OrgProgramSkills";

export const metadata = { title: "Program skills" };

/** Organization-only: say which skills each program teaches, so videos can point to the right program. */
export default async function OrganizationProgramsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Program skills" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Program skills</h1>
      <p className="mt-1 text-sm text-gray-600">When a visitor watches a video about a skill, matching programs are suggested. Tag each program with the skills it teaches.</p>
      <div className="mt-6"><OrgProgramSkills /></div>
    </main>
  );
}
