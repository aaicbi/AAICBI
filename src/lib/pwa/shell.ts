import { getAdminNavGroups } from "@/lib/admin/nav";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import { EMPLOYER_NAV } from "@/lib/employer/nav";
import { INVESTOR_NAV } from "@/lib/investor/nav";
import { INSTRUCTOR_NAV } from "@/lib/instructor/nav";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import type { NavRole } from "@/lib/pwa/mobileNav";

export interface ShellInfo {
  role: NavRole;
  moreItems: Array<{ label: string; href: string }>;
}

/**
 * Which bottom navigation a signed-in account gets, and what "More" lists.
 * Used for pages outside the role areas (events, jobs, organizations,
 * notifications...), so the bar stays with a person as they move around.
 */
export async function shellForSession(session: { userId: string; role: string }): Promise<ShellInfo | null> {
  switch (session.role) {
    case "TRAINEE": return { role: "trainee", moreItems: TRAINEE_NAV };
    case "EMPLOYER": return { role: "employer", moreItems: EMPLOYER_NAV };
    case "INVESTOR": return { role: "investor", moreItems: INVESTOR_NAV };
    case "INSTRUCTOR": return { role: "instructor", moreItems: INSTRUCTOR_NAV };
    case "ADMIN":
    case "SUPER_ADMIN": {
      const org = session.role === "ADMIN" ? await findTrainingOrgByStaffUserId(session.userId).catch(() => null) : null;
      return { role: org ? "organization" : "staff", moreItems: getAdminNavGroups(session.role, !!org).flatMap((g) => g.items) };
    }
    default: return null;
  }
}
