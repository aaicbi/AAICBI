import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EcosystemAdmin from "@/components/ecosystem/EcosystemAdmin";

export const metadata = { title: "Ecosystem" };

/** SUPER_ADMIN: feature switches, organization verification and video moderation. */
export default async function AdminEcosystemPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Ecosystem" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Public ecosystem</h1>
      <div className="mt-6"><EcosystemAdmin /></div>
    </main>
  );
}
