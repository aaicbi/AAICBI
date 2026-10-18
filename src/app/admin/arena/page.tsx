import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ArenaAdmin from "@/components/arena/ArenaAdmin";

export const metadata = { title: "Gaming Arena" };

/** SUPER_ADMIN: turn the Gaming Arena on or off and set its rules, for the whole platform, an organization or a course. */
export default async function AdminArenaPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Gaming Arena" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Gaming Arena</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Two trainees challenge each other on a course, live. Turn it on where you want it and set the rules of play. Everything is off until you switch it on.</p>
      <div className="mt-6"><ArenaAdmin /></div>
    </main>
  );
}
