import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateProjectMediaFile, uploadProjectMedia, MAX_MEDIA_PER_PROJECT } from "@/lib/projectMedia";

/**
 * POST /api/trainee/projects/[id]/media — shared between the trainee
 * who owns the project and any admin (SUPER_ADMIN/ADMIN), same
 * owner-or-staff shape as POST /api/job-postings/[id]/media. A trainee
 * who doesn't own this project gets the same 404 as a nonexistent one
 * — the same non-oracle discipline every ownership check in this app
 * already applies.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN");

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    const isOwner = session.role === "TRAINEE" && project?.traineeId === session.userId;
    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
    if (!project || (!isOwner && !isStaff)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const existingCount = await prisma.projectMedia.count({ where: { projectId: project.id } });
    if (existingCount >= MAX_MEDIA_PER_PROJECT) {
      return NextResponse.json({ error: `A project can have at most ${MAX_MEDIA_PER_PROJECT} media items.` }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validated = validateProjectMediaFile(file);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const url = await uploadProjectMedia(file, `${project.id}`);
    const media = await prisma.projectMedia.create({
      data: { projectId: project.id, type: validated.type, url, order: existingCount },
    });

    return NextResponse.json(media, { status: 201 });
  });
}
