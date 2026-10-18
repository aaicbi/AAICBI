import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import GrowthAdmin from "@/components/growth/GrowthAdmin";

export const metadata = { title: "Growth" };

/** SUPER_ADMIN: switch on the public taster game that brings newcomers into a course, for AAICBI courses or an organization's. */
export default async function AdminGrowthPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Growth" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Growth</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">A public link plays a 5-question taster with no account, then leads to module 1 free and payment after it. Off everywhere until you switch it on. Turn it on for an organization only when you are being paid to market its courses.</p>
      <div className="mt-6"><GrowthAdmin /></div>
    </main>
  );
}
