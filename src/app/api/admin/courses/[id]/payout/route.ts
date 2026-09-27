import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const PayoutSchema = z
  .object({
    payoutType: z.enum(["PERCENTAGE_OF_REVENUE", "FLAT_PER_SUBSCRIBER"]),
    payoutPercentage: z.number().int().min(0).max(100).optional(),
    payoutFlatRateKobo: z.number().int().nonnegative().optional(),
    payoutNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((d) => (d.payoutType === "PERCENTAGE_OF_REVENUE" ? d.payoutPercentage != null : d.payoutFlatRateKobo != null), {
    message: "The rate matching the chosen payout type is required.",
    path: ["payoutPercentage"],
  });

/**
 * PUT /api/admin/courses/[id]/payout — sets an instructor's payout
 * arrangement for a course. Deliberately NOT gated by
 * requireOwnedCourse (that helper has no SUPER_ADMIN bypass by design
 * — see its own comment — which is right for content mutation but
 * wrong here: compensation is a Super Admin-controlled decision per
 * the master spec, so SUPER_ADMIN must be able to set it on any
 * course, while ADMIN stays scoped to courses they own, mirroring
 * createdByFilter's own read-side bypass logic instead.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const course = await prisma.course.findUnique({ where: { id: params.id }, select: { id: true, createdById: true } });
    if (!course || (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId)) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = PayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.course.update({
      where: { id: params.id },
      data: {
        payoutType: parsed.data.payoutType,
        payoutPercentage: parsed.data.payoutType === "PERCENTAGE_OF_REVENUE" ? parsed.data.payoutPercentage : null,
        payoutFlatRateKobo: parsed.data.payoutType === "FLAT_PER_SUBSCRIBER" ? parsed.data.payoutFlatRateKobo : null,
        payoutNotes: parsed.data.payoutNotes || null,
        payoutUpdatedById: session.userId,
        payoutUpdatedAt: new Date(),
      },
      select: {
        id: true,
        payoutType: true,
        payoutPercentage: true,
        payoutFlatRateKobo: true,
        payoutNotes: true,
        payoutUpdatedAt: true,
      },
    });
    return NextResponse.json(updated);
  });
}
