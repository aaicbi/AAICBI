import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import CrmSettings from "@/components/crm/CrmSettings";

export const metadata = { title: "CRM settings" };
export const dynamic = "force-dynamic";

/** The CRM switch for each organization and the registration agreement. For Super Admins, or staff they have trusted with it. */
export default async function CrmSettingsPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.role)) redirect("/admin/dashboard");
  if (!(await hasPermission(session, "crm.agreement:view")) && !(await hasPermission(session, "crm.settings:configure"))) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "CRM", href: "/admin/crm" }, { label: "CRM settings" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">CRM settings</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Choose which training organizations have the CRM, and manage the agreement people sign when they register for a course.</p>
      <div className="mt-6"><CrmSettings /></div>
    </main>
  );
}
