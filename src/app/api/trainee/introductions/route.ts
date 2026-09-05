import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/trainee/introductions — a trainee's own requests, across
 * every status. Employer company/contact name shown freely here — the
 * employer is the one reaching out, so there's no disclosure boundary
 * in this direction the way there is for the trainee's own contact
 * information going the other way.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const requests = await prisma.introductionRequest.findMany({
      where: { traineeId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { employer: { select: { companyName: true, contactName: true } } },
    });
    return NextResponse.json(requests);
  });
}
