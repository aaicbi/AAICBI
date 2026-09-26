import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/showcase — Pitch & Post, Phase 0. Genuinely anonymous, no
 * session required: every Project a trainee has explicitly opted into
 * with `listedInShowcase`, for the public Community Showcase at
 * /showcase. `username` is only ever returned when the trainee's own
 * profile is PUBLIC — same non-oracle discipline as
 * /api/profile/u/[username]: a showcased project never implies a
 * browsable profile that trainee didn't separately choose to expose.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const projects = await prisma.project.findMany({
      where: { listedInShowcase: true },
      orderBy: [{ trainee: { name: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        url: true,
        trainee: {
          select: { name: true, avatarUrl: true, username: true, profileVisibility: true },
        },
      },
    });

    const result = projects.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      url: p.url,
      founderName: p.trainee.name,
      founderAvatarUrl: p.trainee.avatarUrl,
      founderUsername: p.trainee.profileVisibility === "PUBLIC" ? p.trainee.username : null,
    }));

    return NextResponse.json(result);
  });
}
