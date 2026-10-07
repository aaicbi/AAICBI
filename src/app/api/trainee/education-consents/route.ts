import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

/** GET /api/trainee/education-consents — videos an organization wants to feature this trainee in. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const posts = await prisma.educationPost.findMany({
      where: { traineeId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, description: true, youtubeId: true, thumbnailUrl: true, status: true, createdAt: true,
        trainingOrganization: { select: { name: true } },
      },
    });
    return NextResponse.json(
      posts.map((p) => ({ ...p, organizationName: p.trainingOrganization.name, trainingOrganization: undefined }))
    );
  });
}
