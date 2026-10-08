import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { canWithdraw } from "@/lib/ecosystem/videoSubmissionCore";

/** DELETE /api/trainee/videos/[id] — a trainee takes back their own video before it is approved. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const post = await prisma.educationPost.findFirst({
      where: { id: params.id, traineeId: session.userId },
      select: { id: true, status: true, submittedByTrainee: true },
    });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    if (!canWithdraw(post.status, post.submittedByTrainee)) {
      return NextResponse.json({ error: "This video can no longer be withdrawn here." }, { status: 409 });
    }
    await prisma.educationPost.update({ where: { id: post.id }, data: { status: "REMOVED" } });
    return NextResponse.json({ ok: true });
  });
}
