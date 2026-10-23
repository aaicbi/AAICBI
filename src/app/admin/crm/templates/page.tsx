import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import TemplatesManager from "@/components/crm/TemplatesManager";

export const metadata = { title: "Email templates" };
export const dynamic = "force-dynamic";

/** Edit the emails staff send to registrants. Every change is a new version. */
export default async function Page() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/dashboard");
  if (!(await hasPermission(session, "crm.templates:view")) && !(await hasPermission(session, "org_crm.templates:view"))) redirect("/admin/crm");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "CRM", href: "/admin/crm" }, { label: "Email templates" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Email templates</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Edit the emails staff send to registrants. Every change is a new version.</p>
      <div className="mt-6"><TemplatesManager /></div>
    </main>
  );
}
