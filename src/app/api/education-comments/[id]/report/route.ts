import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const Body = z.object({ reason: z.enum(["SPAM", "ABUSE", "OFF_TOPIC", "OTHER"]), details: z.string().trim().max(500).optional() });

/**
 * POST /api/education-comments/[id]/report — flags a comment through the
 * existing profile-report queue (contextType EDUCATION_COMMENT), so staff
 * review it where they already review reports. One open report per
 * reporter and comment.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const limited = await rateLimit(`edu-report:${session.userId}`, 10, 60 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many reports just now." }, { status: 429 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
    const comment = await prisma.educationPostComment.findFirst({ where: { id: params.id, status: "VISIBLE" }, select: { id: true, traineeId: true } });
    if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    if (comment.traineeId === session.userId) return NextResponse.json({ error: "You cannot report your own comment." }, { status: 400 });
    const already = await prisma.profileReport.findFirst({ where: { reporterType: "TRAINEE", reporterId: session.userId, contextType: "EDUCATION_COMMENT", contextId: comment.id, status: "PENDING" }, select: { id: true } });
    if (!already) {
      await prisma.profileReport.create({
        data: { reporterType: "TRAINEE", reporterId: session.userId, reportedType: "TRAINEE", reportedId: comment.traineeId, reason: parsed.data.reason, details: parsed.data.details, contextType: "EDUCATION_COMMENT", contextId: comment.id },
      });
    }
    return NextResponse.json({ reported: true });
  });
}
