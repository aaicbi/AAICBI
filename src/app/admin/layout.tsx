import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import ShellContent from "@/components/pwa/ShellContent";
import { getAdminNavGroups } from "@/lib/admin/nav";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { pageHasSidebar } from "@/lib/sidebarRoutes";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { hasActivePlatformFeeAccess } from "@/lib/trainingOrgBilling";

// Same allow-list every admin page's own getSession()-then-redirect()
// check already uses (e.g. src/app/admin/dashboard/page.tsx) — this
// layout doesn't replace that per-page check (still the real security
// boundary), it only decides sidebar-vs-not for this request.
const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

export const metadata = { title: { default: "Admin", template: "%s · Admin · AAICBI" } };

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
 * Bug fix: that pre-auth check used to be session validity alone —
 * but this middleware's own PUBLIC_ADMIN_PATHS never redirects an
 * already-logged-in admin AWAY from /admin/login, so a staff member
 * with a valid session who still navigates there directly (a stale
 * bookmark, a shared link, testing) got the sidebar wrapped around
 * the login form. pageHasSidebar(pathname) (src/lib/sidebarRoutes.ts,
 * fed the current path via middleware.ts's x-pathname header — the
 * documented way a Server Component layout reads the request path)
 * now also excludes these exact paths regardless of session state.
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
  const pathname = headers().get("x-pathname") ?? "";

  // Trainees, employers and investors have no business in the staff area
  // (certificate design included). Their API calls were always refused;
  // now the pages themselves send them home instead of showing a shell.
  if (session && !isStaff && pageHasSidebar(pathname)) {
    redirect(session.role === "TRAINEE" ? "/trainee/dashboard" : session.role === "EMPLOYER" ? "/employer/dashboard" : session.role === "INVESTOR" ? "/investor/dashboard" : "/");
  }

  if (!isStaff || !pageHasSidebar(pathname)) {
    return <>{children}</>;
  }

  // Account card (photo + name + role, linking to /admin/profile) —
  // session only carries userId/email/role, so this looks up the rest
  // once per request, same as every admin page's own dashboard-data
  // fetch already does with session.userId.
  const staff = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, avatarUrl: true },
  });

  // Training Organizations, Phase 2 — a training org's own login issues
  // a real ADMIN session on its shadow staff account (see
  // training-org-login's own comment), so this is the one place that
  // tells such a session apart from a real staff ADMIN, purely to
  // restrict its sidebar — see ADMIN_NAV_TRAINING_ORG's own comment for
  // why this is cosmetic, not the security boundary.
  const trainingOrg =
    session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId) : null;

  // Direct platform-fee billing — the page-level UX counterpart to
  // requireRole's own API-level gate (session.ts): a billing-gated
  // organization never sees the admin sidebar/content at all, just a
  // clear status page instead of a confusing 403 on every click. The
  // real security boundary is requireRole; this is what makes the
  // experience make sense.
  if (trainingOrg && !hasActivePlatformFeeAccess(trainingOrg)) {
    redirect("/org/billing");
  }

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <AdminSidebar
          name={trainingOrg ? trainingOrg.name : (staff?.name ?? session.email)}
          avatarUrl={staff?.avatarUrl ?? null}
          role={session.role}
          isTrainingOrg={!!trainingOrg}
        />
        <ShellContent role={trainingOrg ? "organization" : session.role === "INSTRUCTOR" ? "instructor" : "staff"} moreItems={getAdminNavGroups(session.role, !!trainingOrg).flatMap((g) => g.items)}>{children}</ShellContent>
      </div>
    </SidebarActiveProvider>
  );
}
