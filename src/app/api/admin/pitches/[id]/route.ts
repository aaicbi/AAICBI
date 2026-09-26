import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const pitch = await prisma.pitchSubmission.findUnique({
      where: { id: params.id },
      include: {
        trainee: { select: { id: true, name: true, email: true } },
        cohort: { select: { id: true, name: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    if (!pitch) {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }
    return NextResponse.json(pitch);
  });
}
