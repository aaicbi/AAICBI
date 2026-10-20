import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import StaffEditor from "@/components/staff/StaffEditor";

export const metadata = { title: "Add staff" };

/** Create a staff account and choose exactly what that person may do. Needs the permission to create staff (a Super Admin always has it). */
export default async function NewStaffPage() {
  const session = await getSession();
  if (!session || !(await hasPermission(session, "staff.accounts:create"))) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "People", href: "/admin/dashboard" }, { label: "Staff", href: "/admin/staff" }, { label: "Add staff" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Add a staff member</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Nobody gets full administrator access by default. Choose a role template or start empty, then tick exactly what this person needs.</p>
      <div className="mt-6"><StaffEditor /></div>
    </main>
  );
}
