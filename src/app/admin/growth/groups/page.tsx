import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import GrowthGroups from "@/components/growth/GrowthGroups";

export const metadata = { title: "Squads and challenges" };

/** SUPER_ADMIN: every squad and friend challenge the taster game has produced, with tools to fix a bad name. */
export default async function GrowthGroupsPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Growth", href: "/admin/growth" }, { label: "Squads and challenges" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Squads and challenges</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Groups and friend duels started from the public taster link. Names are typed by newcomers with no account, so you can rename or remove a squad and clear a nickname here. Scores are never changed.</p>
      <div className="mt-6"><GrowthGroups /></div>
    </main>
  );
}
