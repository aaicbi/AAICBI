import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateJobPostingMediaFile, uploadJobPostingMedia, MAX_MEDIA_PER_POSTING } from "@/lib/jobPostingMedia";

/**
 * POST /api/job-postings/[id]/media — shared between the employer who
 * owns the posting and any admin (SUPER_ADMIN/ADMIN), matching the
 * task's own "employers/admins" scope rather than duplicating this
 * route under both /api/employer/ and /api/admin/. An employer who
 * doesn't own this posting gets the same 404 as a nonexistent posting
 * — the same non-oracle discipline every ownership check in this app
 * already applies, not a 403 that would confirm the posting exists.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER", "SUPER_ADMIN", "ADMIN");

    const posting = await prisma.jobPosting.findUnique({ where: { id: params.id } });
    const isOwner = session.role === "EMPLOYER" && posting?.employerId === session.userId;
    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
    if (!posting || (!isOwner && !isStaff)) {
      return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
    }

    const existingCount = await prisma.jobPostingMedia.count({ where: { jobPostingId: posting.id } });
    if (existingCount >= MAX_MEDIA_PER_POSTING) {
      return NextResponse.json({ error: `A posting can have at most ${MAX_MEDIA_PER_POSTING} media items.` }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validated = validateJobPostingMediaFile(file);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const url = await uploadJobPostingMedia(file, `${posting.id}`);
    const media = await prisma.jobPostingMedia.create({
      data: { jobPostingId: posting.id, type: validated.type, url, order: existingCount },
    });

    return NextResponse.json(media, { status: 201 });
  });
}
