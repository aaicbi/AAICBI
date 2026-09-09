import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { createdByFilter } from "@/lib/courseOwnership";

/**
 * GET /api/admin/payments — course enrollment/subscription system's
 * platform-wide payment reconciliation view (task Section 23).
 * Deliberately its own top-level route rather than nested under a
 * single course, the same reasoning `admin/courses` itself is
 * cross-course: a payment spans every course a staff member has
 * rights to, and reconciliation is inherently a "look across
 * everything" task, not a per-course one.
 *
 * `createdByFilter` reused exactly as-is — same visibility rule as
 * every other cross-course admin list (a non-SUPER_ADMIN only sees
 * payments for courses they created; SUPER_ADMIN sees all). Filtered
 * through the `course` relation since Payment itself has no
 * `createdById` of its own — it belongs to a trainee and a course, not
 * directly to a staff member.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const ownerFilter = createdByFilter(session);

    const payments = await prisma.payment.findMany({
      where: ownerFilter ? { course: ownerFilter } : undefined,
      orderBy: { initiatedAt: "desc" },
      include: {
        trainee: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      take: 500,
    });
    return NextResponse.json(payments);
  });
}
