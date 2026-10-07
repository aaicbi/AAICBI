import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { isFreeEmailProvider } from "@/lib/employerVerification";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/employers — the review queue behind M31's approval
 * mechanism. SUPER_ADMIN/ADMIN only, not INSTRUCTOR — matching
 * PlatformSettings' own established scoping (see that route's own
 * comment): approving an employer is a genuinely platform-wide trust
 * decision, not scoped to any one course an instructor might own, the
 * same reasoning that already separates course-level operational
 * actions from platform-level administrative ones throughout this
 * project.
 *
 * `isFreeEmailProvider` computed here on read, not stored as a
 * separate column — a pure, deterministic function of the email
 * address alone, so storing it would just be a redundant copy that
 * could theoretically drift, not new information.
 *
 * Security audit finding — "platform-wide trust decision" was never
 * actually enforced against a training organization's own shadow
 * staff session, which is also just a plain "ADMIN" role. Employer
 * administration (approve/reject, this list) is exactly the kind of
 * platform-wide authority a training org must never have — spec says
 * it should get view/comment on employer content at most, never
 * administrative control. Blocked outright, same pattern as every
 * other finding in this audit.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const employers = await prisma.employer.findMany({
      orderBy: { createdAt: "desc" },
      include: { approvedBy: { select: { name: true } } },
    });
    const withFlag = employers.map((e: (typeof employers)[number]) => ({
      ...e,
      isFreeEmailProvider: isFreeEmailProvider(e.email),
    }));
    return NextResponse.json(withFlag);
  });
}
