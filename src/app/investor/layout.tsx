import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import InvestorSidebar from "@/components/investor/InvestorSidebar";
import { pageHasSidebar } from "@/lib/sidebarRoutes";

export const metadata = { title: { default: "Investor", template: "%s · Investor · AAICBI" } };

/**
 * Sidebar rollout (Phase 2) — the investor counterpart to
 * src/app/admin/layout.tsx; see that file's own comment for the fuller
 * reasoning. Pre-auth pages (login, register, reset-password) fall
 * through unchanged, even for an investor who still has a valid
 * session cookie and navigates there directly (bug fix — see
 * AdminLayout's own comment for the full story). middleware.ts's
 * matcher was extended to include /investor/:path* so
 * pageHasSidebar's x-pathname header reaches this layout too.
 *
 * No prisma lookup here, unlike trainee/employer — InvestorSidebar has
 * no account card to feed (investors have no profile page).
 */
export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const pathname = headers().get("x-pathname") ?? "";

  if (!session || session.role !== "INVESTOR" || !pageHasSidebar(pathname)) {
    return <>{children}</>;
  }

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <InvestorSidebar />
        <div className="lg:pl-64">{children}</div>
      </div>
    </SidebarActiveProvider>
  );
}
