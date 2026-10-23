import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { accessOf } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import RegistrationsManager from "@/components/crm/RegistrationsManager";
import { crmKey } from "@/lib/crm/staff";

export const metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

/** Course registrations: who registered, what they agreed to and what to do next. AAICBI staff see AAICBI's own; an organization sees only its own. */
export default async function CrmPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/dashboard");
  const access = await accessOf(session);
  if (!access.permissions.has(crmKey(access, "view"))) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Registrations</h1>
        <p className="mt-2 text-sm text-brand-ink">{access.kind === "organization" ? "The CRM is not switched on for your organization yet. Ask AAICBI to switch it on." : "You do not have access to registrations. Ask a Super Admin to give you the CRM permissions."}</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "CRM", href: "/admin/dashboard" }, { label: "Registrations" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Registrations</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">People who registered for a course through its registration page or the taster game. Only people who ticked the box to be contacted should be followed up.</p>
      <div className="mt-6"><RegistrationsManager canManage={access.permissions.has(crmKey(access, "manage"))} canExport={access.permissions.has(crmKey(access, "export"))} canEmail={access.permissions.has(access.kind === "organization" ? "org_crm.email:create" : "crm.email:create")} /></div>
    </main>
  );
}
