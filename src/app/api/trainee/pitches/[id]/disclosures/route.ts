import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/trainee/pitches/[id]/disclosures — the incoming
 * PitchDisclosure requests on this founder's own pitch, shown inline
 * on their pitch's detail page.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const pitch = await prisma.pitchSubmission.findUnique({ where: { id: params.id }, select: { traineeId: true } });
    if (!pitch || pitch.traineeId !== session.userId) {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }
    const disclosures = await prisma.pitchDisclosure.findMany({
      where: { pitchSubmissionId: params.id },
      orderBy: { createdAt: "desc" },
      include: { investor: { select: { name: true, organization: true } } },
    });
    return NextResponse.json(disclosures);
  });
}
