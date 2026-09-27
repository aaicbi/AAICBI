import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/investor/me — mirrors GET /api/employer/me: deliberately
 * minimal, just what the status page and the dashboard's own approval
 * guard actually need.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("INVESTOR");
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: session.userId },
      select: { name: true, organization: true, approvalState: true },
    });
    return NextResponse.json(investor);
  });
}
