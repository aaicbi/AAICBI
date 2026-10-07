import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/auth/session";
import { PUBLIC_POST_WHERE } from "@/lib/ecosystem/queries";

function parseKind(raw: string) {
  const kind = raw.toUpperCase();
  return kind === "LIKE" || kind === "SAVE" ? (kind as "LIKE" | "SAVE") : null;
}

/**
 * POST/DELETE /api/trainee/education-posts/[id]/reactions/[like|save] — a
 * signed-in trainee likes or saves a published video. One row per
 * (video, trainee, kind), so repeating the request changes nothing.
 */
export async function POST(_req: Request, { params }: { params: { id: string; kind: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const kind = parseKind(params.kind);
    if (!kind) return NextResponse.json({ error: "Unknown reaction." }, { status: 400 });
    const limited = await rateLimit(`edu-react:${session.userId}`, 60, 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
    const post = await prisma.educationPost.findFirst({ where: { id: params.id, ...PUBLIC_POST_WHERE }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    await prisma.educationPostReaction.upsert({
      where: { postId_traineeId_kind: { postId: post.id, traineeId: session.userId, kind } },
      update: {},
      create: { postId: post.id, traineeId: session.userId, kind },
    });
    return NextResponse.json({ active: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; kind: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const kind = parseKind(params.kind);
    if (!kind) return NextResponse.json({ error: "Unknown reaction." }, { status: 400 });
    await prisma.educationPostReaction.deleteMany({ where: { postId: params.id, traineeId: session.userId, kind } });
    return NextResponse.json({ active: false });
  });
}
