import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { deleteJobPostingMediaBestEffort } from "@/lib/jobPostingMedia";

/**
 * DELETE /api/job-postings/[id]/media/[mediaId] — same
 * owner-or-admin check as the upload route. `mediaId` is separately
 * verified to actually belong to `id` (not just to exist somewhere),
 * the same "an id in the URL is never trusted alone" discipline every
 * other item-level route in this app applies.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string; mediaId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER", "SUPER_ADMIN", "ADMIN");

    const posting = await prisma.jobPosting.findUnique({ where: { id: params.id } });
    const isOwner = session.role === "EMPLOYER" && posting?.employerId === session.userId;
    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
    if (!posting || (!isOwner && !isStaff)) {
      return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
    }

    const media = await prisma.jobPostingMedia.findUnique({ where: { id: params.mediaId } });
    if (!media || media.jobPostingId !== posting.id) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    await prisma.jobPostingMedia.delete({ where: { id: media.id } });
    await deleteJobPostingMediaBestEffort(media.url);

    return NextResponse.json({ ok: true });
  });
}
