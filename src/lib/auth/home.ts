import type { SessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Where a signed-in person's own dashboard is. It is worked out on the server from the session's role (never from anything
 * the browser sends), and is only a convenience link: the dashboard pages and their APIs check the role again themselves.
 */
export async function dashboardHrefFor(session: SessionPayload): Promise<string> {
  switch (session.role) {
    case "TRAINEE": return "/trainee/dashboard";
    case "EMPLOYER": return "/employer/dashboard";
    case "INVESTOR": return "/investor/dashboard";
    case "INSTRUCTOR": return "/instructor/dashboard";
    case "ADMIN": {
      // A training organization signs in as an ADMIN on its own account and lands on its organization overview.
      const org = await prisma.trainingOrganization.findFirst({ where: { staffUserId: session.userId }, select: { id: true } });
      return org ? "/admin/organization" : "/admin/dashboard";
    }
    case "SUPER_ADMIN": return "/admin/dashboard";
    default: return "/";
  }
}
