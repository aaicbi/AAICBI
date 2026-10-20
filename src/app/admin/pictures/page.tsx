import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PicturesAdmin from "@/components/admin/PicturesAdmin";

export const metadata = { title: "Pictures" };

/** SUPER_ADMIN: shrink the profile pictures, logos, flyers and covers uploaded before pictures were saved small. */
export default async function AdminPicturesPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Pictures" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Pictures</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Large pictures slow pages down on a poor connection. New uploads are already saved small; this shrinks the ones uploaded earlier.</p>
      <div className="mt-6"><PicturesAdmin /></div>
    </main>
  );
}
