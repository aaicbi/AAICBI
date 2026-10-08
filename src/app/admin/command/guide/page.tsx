import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import GuideManager from "@/components/admin/GuideManager";

export const metadata = { title: "Loop guide" };

/** SUPER_ADMIN: Loop's switch, the answers written by hand, and the questions Loop could not answer. */
export default async function AdminGuidePage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Platform", href: "/admin/dashboard" }, { label: "Command Center", href: "/admin/command" }, { label: "Loop guide" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Guide Bot Knowledge</h1>
      <p className="mt-1 text-sm text-gray-600">What Loop knows, what it could not answer, and what visitors struggle with. Loop only uses answers a person wrote or approved.</p>
      <div className="mt-6">
        <GuideManager />
      </div>
    </main>
  );
}
