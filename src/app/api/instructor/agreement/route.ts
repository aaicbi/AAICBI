import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/instructor/agreement — the logged-in instructor's own latest
 * agreement (any status), backing the onboarding gate at
 * /instructor/agreement. `sentBy.name` is included so the page can show
 * who sent it; the actual compensation figure lives in `content` (the
 * resolved snapshot) or the raw fields below, never re-derived from a
 * template the instructor has no access to.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("INSTRUCTOR");

    const agreement = await prisma.instructorAgreement.findFirst({
      where: { instructorId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { sentBy: { select: { name: true } } },
    });

    return NextResponse.json(agreement);
  });
}
