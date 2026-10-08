import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rateLimit";
import { EscalateSchema, canEscalate } from "@/lib/ecosystem/videoSubmissionCore";

/**
 * POST /api/trainee/videos/[id]/escalate — the trainee sends their own
 * video to SUPER_ADMIN for review because the organization has not acted on
 * it or declined it. It then appears in the same review queue as any other
 * video, marked as sent by the trainee, with their reason.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const limited = await rateLimit(`trainee-video-escalate:${session.userId}`, 10, 24 * 60 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many requests today. Try again tomorrow." }, { status: 429 });
    const parsed = EscalateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Tell us what went wrong." }, { status: 400 });

    const post = await prisma.educationPost.findFirst({
      where: { id: params.id, traineeId: session.userId },
      select: { id: true, status: true, submittedByTrainee: true },
    });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    if (!canEscalate(post.status, post.submittedByTrainee)) {
      return NextResponse.json({ error: "This video cannot be sent to AAICBI from its current state." }, { status: 409 });
    }
    // Guarded on the status we just read, so a double tap or a late
    // organization decision cannot be applied twice.
    const changed = await prisma.educationPost.updateMany({
      where: { id: post.id, status: post.status },
      data: { status: "PENDING_REVIEW", escalatedAt: new Date(), escalationNote: parsed.data.reason },
    });
    if (changed.count === 0) return NextResponse.json({ error: "This video just changed. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ status: "PENDING_REVIEW" });
  });
}
