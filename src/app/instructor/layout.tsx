import { getSession } from "@/lib/auth/session";
import { SidebarActiveProvider } from "@/components/SidebarActiveContext";
import SidebarBackBar from "@/components/SidebarBackBar";
import InstructorSidebar from "@/components/instructor/InstructorSidebar";

export const metadata = { title: { default: "Instructor", template: "%s · Instructor · AAICBI" } };

/**
 * Sidebar rollout (Phase 2) — the instructor counterpart to
 * src/app/admin/layout.tsx; see that file's own comment for the fuller
 * reasoning. Unlike every other role, instructor has no pre-auth pages
 * at all (an INSTRUCTOR is a staff `User` row that signs in through
 * /admin/login) — the `!session` branch below only matters for a
 * not-yet-authenticated visit to an /instructor/* URL, where the
 * page's own client-side requireRole("INSTRUCTOR") check (unchanged by
 * this file) still does the real redirect to /admin/login; this layout
 * only decides whether the sidebar chrome renders meanwhile.
 */
export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== "INSTRUCTOR") {
    return <>{children}</>;
  }

  return (
    <SidebarActiveProvider>
      <div className="min-h-screen">
        <InstructorSidebar />
        <div className="lg:pl-64">
          <SidebarBackBar />
          {children}
        </div>
      </div>
    </SidebarActiveProvider>
  );
}
