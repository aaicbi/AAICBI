import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/auth/session";
import { PUBLIC_POST_WHERE } from "@/lib/ecosystem/queries";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { CommentSchema } from "@/lib/ecosystem/commentCore";

export const dynamic = "force-dynamic";

/**
 * POST /api/education-posts/[id]/comments — a signed-in trainee comments on
 * a published video. Plain text only (links rejected), rate-limited, and
 * hidden or reported like any other user content.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const flags = await getEcosystemFlags();
    if (!flags.education || !flags.orgPages) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const limited = await rateLimit(`edu-comment:${session.userId}`, 10, 60 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "You have commented a lot just now. Try again in a bit." }, { status: 429 });
    const parsed = CommentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your comment." }, { status: 400 });
    const post = await prisma.educationPost.findFirst({ where: { id: params.id, ...PUBLIC_POST_WHERE }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    const comment = await prisma.educationPostComment.create({
      data: { postId: post.id, traineeId: session.userId, body: parsed.data.body },
      select: { id: true, body: true, createdAt: true, trainee: { select: { name: true } } },
    });
    return NextResponse.json({ id: comment.id, body: comment.body, createdAt: comment.createdAt, authorName: comment.trainee.name, mine: true }, { status: 201 });
  });
}
