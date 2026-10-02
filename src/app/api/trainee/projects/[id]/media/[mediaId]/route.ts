import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { deleteProjectMediaBestEffort } from "@/lib/projectMedia";

/**
 * DELETE /api/trainee/projects/[id]/media/[mediaId] — same
 * owner-or-admin check as the upload route. Lets a trainee remove a
 * file before submitting, and lets an admin strip one inappropriate
 * item from an otherwise-fine showcase post without rejecting the
 * whole thing (see /admin/showcase's own use of this).
 */
export async function DELETE(_req: Request, { params }: { params: { id: string; mediaId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN");

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    const isOwner = session.role === "TRAINEE" && project?.traineeId === session.userId;
    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
    if (!project || (!isOwner && !isStaff)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const media = await prisma.projectMedia.findUnique({ where: { id: params.mediaId } });
    if (!media || media.projectId !== project.id) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    await prisma.projectMedia.delete({ where: { id: media.id } });
    await deleteProjectMediaBestEffort(media.url);

    return NextResponse.json({ ok: true });
  });
}
