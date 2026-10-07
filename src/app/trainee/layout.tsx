import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import TraineeSidebar from "@/components/trainee/TraineeSidebar";
import FloatingMessagesButton from "@/components/trainee/FloatingMessagesButton";
import { pageHasSidebar } from "@/lib/sidebarRoutes";

export const metadata = { title: { default: "Trainee", template: "%s · Trainee · AAICBI" } };

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
 *
 * FloatingMessagesButton lives here too, not the sidebar — it's a
 * persistent shortcut meant to float over EVERY authenticated trainee
 * page (it excludes itself on the two live exam/assessment screens;
 * see its own comment), same "mount once" reasoning as TourGuideButton
 * in the root layout, just scoped to this one role's pages instead of
 * the whole app.
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
        <FloatingMessagesButton />
      </div>
    </SidebarActiveProvider>
  );
}
