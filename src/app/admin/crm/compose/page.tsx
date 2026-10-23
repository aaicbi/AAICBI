import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { accessOf } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmailComposer from "@/components/crm/EmailComposer";

export const metadata = { title: "Write an email" };
export const dynamic = "force-dynamic";

/** The email composer, opened from a registration. */
export default async function ComposePage({ searchParams }: { searchParams: { r?: string } }) {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/dashboard");
  const access = await accessOf(session);
  const id = typeof searchParams.r === "string" ? searchParams.r : "";
  if (!id || !access.permissions.has(access.kind === "organization" ? "org_crm.email:create" : "crm.email:create")) redirect("/admin/crm");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "CRM", href: "/admin/crm" }, { label: "Registrations", href: `/admin/crm?r=${encodeURIComponent(id)}` }, { label: "Write an email" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Write an email</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Emails go out from an approved sender with the AAICBI letterhead. A service message is about their registration. A marketing message needs their agreement to news and offers.</p>
      <div className="mt-6"><EmailComposer registrationId={id} /></div>
    </main>
  );
}
