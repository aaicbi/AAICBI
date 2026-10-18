import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import GrowthReport from "@/components/growth/GrowthReport";

export const metadata = { title: "Growth report" };

/** The campaign report and commission ledger. A Super Admin sees every campaign; an organization sees only its own courses. */
export default async function GrowthReportPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Insight", href: "/admin/dashboard" }, { label: "Growth report" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Growth report</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">How many people went from the free taster game to a payment, where they came from, and what each organization owes AAICBI for the payments the campaigns brought in.</p>
      <div className="mt-6"><GrowthReport isSuper={session.role === "SUPER_ADMIN"} /></div>
    </main>
  );
}
