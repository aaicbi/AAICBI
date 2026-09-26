import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyInvestorOfDisclosureResponse } from "@/lib/pitchNotify";

const RespondSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
  shareVideo: z.boolean().optional(),
  shareDeck: z.boolean().optional(),
  shareDemo: z.boolean().optional(),
  shareGithub: z.boolean().optional(),
});

/**
 * POST /api/trainee/pitches/[id]/disclosures/[discId]/respond — the
 * founder's own idea-protection gate: an investor only ever sees the
 * materials the founder explicitly checks here, only after ACCEPT.
 * Mirrors POST /api/trainee/introductions/[id]/respond's accept/decline
 * shape and its "re-responding is allowed" reasoning — a founder
 * changing their mind about what to share is a real, expected case.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; discId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const disclosure = await prisma.pitchDisclosure.findUnique({
      where: { id: params.discId },
      include: { pitch: { select: { id: true, traineeId: true, startupName: true } } },
    });
    if (!disclosure || disclosure.pitchSubmissionId !== params.id || disclosure.pitch.traineeId !== session.userId) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = RespondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.action === "DECLINE") {
      await prisma.pitchDisclosure.update({
        where: { id: params.discId },
        data: {
          status: "DECLINED",
          shareVideo: false,
          shareDeck: false,
          shareDemo: false,
          shareGithub: false,
          respondedAt: new Date(),
        },
      });
      await notifyInvestorOfDisclosureResponse(disclosure.investorId, disclosure.pitch.id, disclosure.pitch.startupName, false);
      return NextResponse.json({ ok: true });
    }

    await prisma.pitchDisclosure.update({
      where: { id: params.discId },
      data: {
        status: "ACCEPTED",
        shareVideo: parsed.data.shareVideo ?? false,
        shareDeck: parsed.data.shareDeck ?? false,
        shareDemo: parsed.data.shareDemo ?? false,
        shareGithub: parsed.data.shareGithub ?? false,
        respondedAt: new Date(),
      },
    });
    await notifyInvestorOfDisclosureResponse(disclosure.investorId, disclosure.pitch.id, disclosure.pitch.startupName, true);

    return NextResponse.json({ ok: true });
  });
}
