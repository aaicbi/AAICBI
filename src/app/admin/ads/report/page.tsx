import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import AdsReport from "@/components/ads/AdsReport";

export const metadata = { title: "Ads report" };

/** Views, taps and tap rate for each ad. A Super Admin sees every ad; an organization sees only its own. */
export default async function AdsReportPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.role)) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Insight", href: "/admin/dashboard" }, { label: "Ads report" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Ads report</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">How many people saw each ad, how many tapped it, and the tap rate.</p>
      <div className="mt-6"><AdsReport isSuper={session.role === "SUPER_ADMIN"} /></div>
    </main>
  );
}
