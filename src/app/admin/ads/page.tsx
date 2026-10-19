import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import AdsAdmin from "@/components/ads/AdsAdmin";

export const metadata = { title: "Ads" };

/** SUPER_ADMIN: book ads for organizations, record payment, and switch ads on or off. */
export default async function AdminAdsPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Ads" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Ads</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Put an organization&apos;s ad on the feed and the About page. You arrange payment outside the app and record it here; an ad that is not paid for (or free) is never shown. Every ad is labelled Sponsored.</p>
      <p className="mt-3"><Link href="/admin/ads/report" className="font-semibold text-brand-teal underline" data-testid="to-ads-report">See views and taps for each ad</Link></p>
      <div className="mt-6"><AdsAdmin /></div>
    </main>
  );
}
