import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedEmployer } from "@/lib/employerAccess";
import { requireApprovedInvestor } from "@/lib/investorAccess";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { listDiscoverableOrganizations } from "@/lib/ecosystem/orgDiscovery";

export const dynamic = "force-dynamic";

function notFound() {
  const err = new Error("Not found.") as Error & { status?: number };
  err.status = 404;
  return err;
}

/**
 * GET /api/ecosystem/organizations?skill= — approved employers and
 * investors browse organizations with a public page. 404 while the
 * organization-pages switch is off, and for unapproved accounts (same
 * not-found style as the rest of employer and investor access).
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER", "INVESTOR");
    if (session.role === "EMPLOYER") await requireApprovedEmployer(session.userId);
    else await requireApprovedInvestor(session.userId);
    if (!(await getEcosystemFlags()).orgPages) throw notFound();

    const skill = (req.nextUrl.searchParams.get("skill") ?? "").trim().slice(0, 60);
    const orgs = await listDiscoverableOrganizations(skill);
    const watched =
      session.role === "INVESTOR"
        ? new Set((await prisma.organizationWatchlistItem.findMany({ where: { investorId: session.userId }, select: { trainingOrganizationId: true } })).map((w) => w.trainingOrganizationId))
        : new Set<string>();
    return NextResponse.json({
      role: session.role,
      organizations: orgs.map((o) => ({ ...o, watching: watched.has(o.id) })),
    });
  });
}
