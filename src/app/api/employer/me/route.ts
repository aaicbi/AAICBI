import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/employer/me — deliberately minimal, just what the status
 * page actually needs right now (company name, approval state) rather
 * than a full settings system this milestone doesn't scope yet.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const employer = await prisma.employer.findUniqueOrThrow({
      where: { id: session.userId },
      select: { companyName: true, contactName: true, approvalState: true, onboardingCompletedAt: true },
    });
    return NextResponse.json(employer);
  });
}
