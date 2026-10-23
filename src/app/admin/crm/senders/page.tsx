import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import SendersManager from "@/components/crm/SendersManager";

export const metadata = { title: "Email senders" };
export const dynamic = "force-dynamic";

/** The approved addresses emails go out from, and the steps to verify a domain in Resend. */
export default async function Page() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/dashboard");
  if (!(await hasPermission(session, "crm.senders:view"))) redirect("/admin/crm");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "CRM", href: "/admin/crm" }, { label: "Email senders" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Email senders</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">The approved addresses emails go out from, and the steps to verify a domain in Resend.</p>
      <div className="mt-6"><SendersManager /></div>
    </main>
  );
}
