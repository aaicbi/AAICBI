import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const DecideSchema = z.object({ action: z.enum(["REVIEWED", "DISMISSED", "ACTION_TAKEN"]) });

/**
 * POST /api/admin/reports/[id]/decide — mirrors
 * /api/admin/employers/[id]/decide's exact shape: SUPER_ADMIN/ADMIN
 * only, `[id]` is the report being decided (not the caller), and
 * re-deciding an already-decided report is allowed rather than locked
 * — a real "actually this needs a second look" is a legitimate case.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const report = await prisma.profileReport.findUnique({ where: { id: params.id } });
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const updated = await prisma.profileReport.update({
      where: { id: params.id },
      data: {
        status: parsed.data.action,
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  });
}
