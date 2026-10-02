import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/showcase/[id] — the single-project detail view behind a
 * Community Showcase card. Anonymous, same as the list route. A
 * project that exists but isn't listed, or isn't yet approved, returns
 * the same 404 as one that doesn't exist at all, so this can't be used
 * to confirm a trainee has an unlisted or pending project.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        url: true,
        listedInShowcase: true,
        showcaseStatus: true,
        media: { orderBy: { order: "asc" }, select: { id: true, type: true, url: true } },
        trainee: {
          select: { name: true, avatarUrl: true, username: true, profileVisibility: true },
        },
      },
    });

    if (!project || !project.listedInShowcase || project.showcaseStatus !== "APPROVED") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      title: project.title,
      description: project.description,
      url: project.url,
      media: project.media,
      founderName: project.trainee.name,
      founderAvatarUrl: project.trainee.avatarUrl,
      founderUsername: project.trainee.profileVisibility === "PUBLIC" ? project.trainee.username : null,
    });
  });
}
