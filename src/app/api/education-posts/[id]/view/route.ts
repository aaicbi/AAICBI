import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/education-posts/[id]/view — anonymous, counts one view of a
 * published video. Rate-limited per video and per caller so the counter
 * cannot be inflated by a loop; it feeds the organization's own
 * dashboard only and is not used for any ranking yet.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const ip = clientIp(req);
    const limited = await rateLimit(`edu-view:${params.id}:${ip}`, 1, 30 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ counted: false });
    const result = await prisma.educationPost.updateMany({
      where: { id: params.id, status: "PUBLISHED" },
      data: { viewCount: { increment: 1 } },
    });
    if (result.count > 0) {
      const post = await prisma.educationPost.findUnique({ where: { id: params.id }, select: { trainingOrganizationId: true } });
      if (post) await prisma.ecosystemEvent.create({ data: { type: "VIDEO_VIEW", trainingOrganizationId: post.trainingOrganizationId, postId: params.id } });
    }
    return NextResponse.json({ counted: result.count > 0 });
  });
}
