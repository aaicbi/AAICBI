import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import TraineeSidebar from "@/components/trainee/TraineeSidebar";
import { pageHasSidebar } from "@/lib/sidebarRoutes";

/**
 * Sidebar rollout (Phase 2) — the trainee counterpart to
 * src/app/admin/layout.tsx; see that file's own comment for the fuller
 * reasoning (pre-auth pages fall through unchanged, every other
 * page's own SiteHeader call goes inert via SidebarActiveProvider, and
 * this role check only decides sidebar-vs-not — each page's own
 * getSession()-then-redirect() stays the real security boundary).
 *
 * Covers login, register, forgot-password, reset-password, and verify
 * — all pre-auth, all keep their current plain header unchanged, even
 * for a trainee who still has a valid session cookie and navigates
 * there directly (bug fix — see AdminLayout's own comment for the
 * full story; pageHasSidebar excludes these paths regardless of
 * session state).
 */
export default async function TraineeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const pathname = headers().get("x-pathname") ?? "";

  if (!session || session.role !== "TRAINEE" || !pageHasSidebar(pathname)) {
    return <>{children}</>;
  }

  const trainee = await prisma.trainee.findUnique({
    where: { id: session.userId },
    select: { name: true, avatarUrl: true },
  });

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <TraineeSidebar name={trainee?.name ?? session.email} avatarUrl={trainee?.avatarUrl ?? null} />
        <div className="sm:pl-64">{children}</div>
      </div>
    </SidebarActiveProvider>
  );
}
