import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import RequestsInbox from "@/components/requests/RequestsInbox";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/** /admin/requests — the change-request inbox. Staff propose changes; a Super Admin approves them for Claude Code. */
export default function RequestsPage() {
  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="px-4 py-6">
        <RequestsInbox />
      </main>
    </>
  );
}
