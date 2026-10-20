import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import StaffEditor from "@/components/staff/StaffEditor";

export const metadata = { title: "Staff access" };

/** Change a staff member's details and permissions, with the history of changes. */
export default async function StaffAccessPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !(await hasPermission(session, "staff.permissions:view"))) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "People", href: "/admin/dashboard" }, { label: "Staff", href: "/admin/staff" }, { label: "Access" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Staff access</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">What this person can open and do. Changes apply on their next request, including if they are signed in now.</p>
      <div className="mt-6"><StaffEditor id={params.id} /></div>
    </main>
  );
}
