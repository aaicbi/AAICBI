import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { statusAfterModeration } from "@/lib/ecosystem/educationPostCore";

const Body = z.object({ action: z.enum(["approve", "reject", "remove"]), note: z.string().trim().max(500).optional() });

/** POST /api/admin/ecosystem/posts/[id] — SUPER_ADMIN approves, rejects or pulls a video. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const post = await prisma.educationPost.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });

    const next = statusAfterModeration(post.status, parsed.data.action);
    if (!next) return NextResponse.json({ error: "That action is not available for this video's current state." }, { status: 409 });
    await prisma.educationPost.update({
      where: { id: post.id },
      data: {
        status: next,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note || null,
        ...(next === "PUBLISHED" && { publishedAt: new Date() }),
      },
    });
    return NextResponse.json({ status: next });
  });
}
