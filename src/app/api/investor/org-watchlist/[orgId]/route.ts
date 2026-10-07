import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedInvestor } from "@/lib/investorAccess";

export const dynamic = "force-dynamic";

async function guard(orgId: string) {
  const session = await requireRole("INVESTOR");
  await requireApprovedInvestor(session.userId);
  // Only organizations that are public can be watched; anything else is a plain 404.
  const org = await prisma.trainingOrganization.findFirst({
    where: { id: orgId, approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } } },
    select: { id: true },
  });
  if (!org) {
    const err = new Error("Not found.") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return session.userId;
}

/** PUT — watch an organization. Repeating it changes nothing. */
export async function PUT(_req: Request, { params }: { params: { orgId: string } }) {
  return withApiErrors(async () => {
    const investorId = await guard(params.orgId);
    await prisma.organizationWatchlistItem.upsert({
      where: { investorId_trainingOrganizationId: { investorId, trainingOrganizationId: params.orgId } },
      update: {},
      create: { investorId, trainingOrganizationId: params.orgId },
    });
    return NextResponse.json({ watching: true });
  });
}

/** DELETE — stop watching. Also idempotent. */
export async function DELETE(_req: Request, { params }: { params: { orgId: string } }) {
  return withApiErrors(async () => {
    const investorId = await guard(params.orgId);
    await prisma.organizationWatchlistItem.deleteMany({ where: { investorId, trainingOrganizationId: params.orgId } });
    return NextResponse.json({ watching: false });
  });
}
