import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateActiveSchema = z.object({ active: z.boolean() });

/**
 * GET /api/admin/instructors/[id] — the detail view backing
 * /admin/instructors/[id]: profile, full agreement history (never just
 * the latest — spec Section 28 wants version history visible), and the
 * courses they own with their current payout configuration attached,
 * since that's this page's own edit surface.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");

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
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");

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
