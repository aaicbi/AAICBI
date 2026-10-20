import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import OrgGames from "@/components/orggames/OrgGames";

export const metadata = { title: "Games" };

/** A training organization's view of games on its own courses: results, live games, moderation and settings, within what the platform allows. */
export default async function OrganizationGamesPage() {
  const session = await getSession();
  if (!session || !(await hasPermission(session, "org_games.results:view"))) redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Games" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Games</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">See how your trainees play, watch live games and keep play fair on your own courses.</p>
      <div className="mt-6"><OrgGames /></div>
    </main>
  );
}
