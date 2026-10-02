import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import EmployerSidebar from "@/components/employer/EmployerSidebar";
import { pageHasSidebar } from "@/lib/sidebarRoutes";

/**
 * Sidebar rollout (Phase 2) — the employer counterpart to
 * src/app/admin/layout.tsx; see that file's own comment for the fuller
 * reasoning. Pre-auth pages (login, register — employer has no
 * forgot-password/reset-password flow) fall through unchanged, even
 * for an employer who still has a valid session cookie and navigates
 * there directly (bug fix — see AdminLayout's own comment for the
 * full story). middleware.ts's matcher was extended to include
 * /employer/:path* so pageHasSidebar's x-pathname header reaches
 * this layout too.
 *
 * Deliberately does not replicate the dashboard page's own
 * approval-state gate (PENDING/REJECTED employers redirect to
 * /employer/status) — that stays each page's own business logic; this
 * check only decides whether the sidebar chrome appears at all.
 */
export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const pathname = headers().get("x-pathname") ?? "";

  if (!session || session.role !== "EMPLOYER" || !pageHasSidebar(pathname)) {
    return <>{children}</>;
  }

  const employer = await prisma.employer.findUnique({
    where: { id: session.userId },
    select: { companyName: true },
  });

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <EmployerSidebar companyName={employer?.companyName ?? session.email} />
        <div className="sm:pl-64">{children}</div>
      </div>
    </SidebarActiveProvider>
  );
}
