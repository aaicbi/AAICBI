import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

const UpdateActiveSchema = z.object({ active: z.boolean() });

/**
 * GET /api/admin/instructors/[id] — the detail view backing
 * /admin/instructors/[id]: profile, full agreement history (never just
 * the latest — spec Section 28 wants version history visible), and the
 * courses they own with their current payout configuration attached,
 * since that's this page's own edit surface.
 *
 * Security audit finding — blocked for a training-org session the same
 * way as the list route (see that file's own comment): no legitimate
 * reason a training org would ever reach a real instructor's profile,
 * agreement history, or payout configuration.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const instructor = await prisma.user.findUnique({
      where: { id: params.id, role: "INSTRUCTOR" },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        jobTitle: true,
        areasOfResponsibility: true,
        createdAt: true,
        instructorAgreementsOwned: {
          orderBy: { createdAt: "desc" },
          include: { sentBy: { select: { name: true } } },
        },
        courses: {
          select: {
            id: true,
            title: true,
            status: true,
            payoutType: true,
            payoutPercentage: true,
            payoutFlatRateKobo: true,
            payoutNotes: true,
            payoutUpdatedAt: true,
          },
        },
      },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }
    return NextResponse.json(instructor);
  });
}

/**
 * PATCH /api/admin/instructors/[id] — the deactivation lever (User.active,
 * see its own schema comment). No self-lockout guard needed here the way
 * PATCH /api/admin/staff/[id] has one — an INSTRUCTOR row is never the
 * caller's own account in this route's context, so there's no risk of a
 * Super Admin deactivating themselves through it.
 *
 * Security audit finding (severe) — this let any plain "ADMIN" session
 * deactivate ANY real AAICBI instructor account platform-wide, which
 * included a training organization's own shadow staff session. Blocked
 * the same way as the GET route above.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateActiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const instructor = await prisma.user.findUnique({ where: { id: params.id, role: "INSTRUCTOR" } });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { active: parsed.data.active },
      select: { id: true, active: true },
    });
    return NextResponse.json(updated);
  });
}
