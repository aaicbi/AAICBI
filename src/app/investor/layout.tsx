import { getSession } from "@/lib/auth/session";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import InvestorSidebar from "@/components/investor/InvestorSidebar";

/**
 * Sidebar rollout (Phase 2) — the investor counterpart to
 * src/app/admin/layout.tsx; see that file's own comment for the fuller
 * reasoning. Pre-auth pages (login, register, reset-password) fall
 * through unchanged.
 *
 * No prisma lookup here, unlike trainee/employer — InvestorSidebar has
 * no account card to feed (investors have no profile page).
 */
export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== "INVESTOR") {
    return <>{children}</>;
  }

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <InvestorSidebar />
        <div className="sm:pl-64">{children}</div>
      </div>
    </SidebarActiveProvider>
  );
}
