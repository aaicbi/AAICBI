import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import GrowthAdmin from "@/components/growth/GrowthAdmin";
import GrowthMessaging from "@/components/growth/GrowthMessaging";
import GrowthWhatsApp from "@/components/growth/GrowthWhatsApp";
import GrowthShare from "@/components/growth/GrowthShare";

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
      <p className="mt-3"><Link href="/admin/growth/report" className="font-semibold text-brand-teal underline" data-testid="to-report">See the campaign report and commission ledger</Link> · <Link href="/admin/growth/groups" className="font-semibold text-brand-teal underline" data-testid="to-groups">Squads and challenges</Link></p>
      <div className="mt-6"><GrowthAdmin /></div>
      <div className="mt-10 border-t border-brand-gray/60 pt-8"><GrowthShare /></div>
      <div className="mt-10 border-t border-brand-gray/60 pt-8"><GrowthWhatsApp /></div>
      <div className="mt-10 border-t border-brand-gray/60 pt-8"><GrowthMessaging /></div>
    </main>
  );
}
