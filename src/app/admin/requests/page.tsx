import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import RequestsInbox from "@/components/requests/RequestsInbox";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/** /admin/requests — the change-request inbox. Super Admin only: they write requests, approve them and hand them to Claude Code. */
export default async function RequestsPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="px-4 py-6">
        <RequestsInbox />
      </main>
    </>
  );
}
