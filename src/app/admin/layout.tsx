import { getSession } from "@/lib/auth/session";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import AdminSidebar from "@/components/admin/AdminSidebar";

// Same allow-list every admin page's own getSession()-then-redirect()
// check already uses (e.g. src/app/admin/dashboard/page.tsx) — this
// layout doesn't replace that per-page check (still the real security
// boundary), it only decides sidebar-vs-not for this request.
const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

/**
 * Admin sidebar pilot — the one place a persistent left sidebar is
 * rendered for every authenticated admin page, replacing the old
 * cramped top SiteHeader bar (see the plan this shipped from).
 *
 * Pre-auth admin pages (/admin/login, /admin/forgot-password,
 * /admin/reset-password) have no valid staff session yet, so they
 * fall through here unchanged — no sidebar, no provider — and keep
 * rendering their own existing plain SiteHeader exactly as before.
 *
 * Every other admin page's own `<SiteHeader nav={...}
 * right={<LogoutButton />} />` call is deliberately left in place
 * (not stripped) — SidebarActiveProvider makes SiteHeader render
 * null for the duration of this subtree. See SiteHeader.tsx's own
 * comment and the plan's stated trade-off for why.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const isStaff = !!session && ALLOWED_ROLES.includes(session.role);

  if (!isStaff) {
    return <>{children}</>;
  }

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <AdminSidebar />
        <div className="sm:pl-64">{children}</div>
      </div>
    </SidebarActiveProvider>
  );
}
