import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

/** DELETE /api/org/education-posts/[id] — an organization withdraws one of its own videos. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const post = await prisma.educationPost.findFirst({ where: { id: params.id, trainingOrganizationId: org.id }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    await prisma.educationPost.update({ where: { id: post.id }, data: { status: "REMOVED" } });
    return NextResponse.json({ ok: true });
  });
}
