import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const FlagsSchema = z.object({
  ecosystemOrgPagesEnabled: z.boolean().optional(),
  ecosystemEducationEnabled: z.boolean().optional(),
  ecosystemFeedEnabled: z.boolean().optional(),
});

/**
 * GET/PUT /api/admin/ecosystem — SUPER_ADMIN only. Feature switches, the
 * list of organizations with their public-profile state, and the
 * education-post moderation queue in one payload for /admin/ecosystem.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const [settings, orgs, posts] = await Promise.all([
      prisma.platformSettings.findUnique({
        where: { id: "singleton" },
        select: { ecosystemOrgPagesEnabled: true, ecosystemEducationEnabled: true, ecosystemFeedEnabled: true },
      }),
      prisma.trainingOrganization.findMany({
        where: { approvalState: "APPROVED" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, isDemo: true, publicProfile: { select: { slug: true, publicEnabled: true, verified: true } } },
      }),
      prisma.educationPost.findMany({
        where: { status: { in: ["PENDING_REVIEW", "PUBLISHED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, title: true, status: true, youtubeUrl: true, thumbnailUrl: true, description: true, createdAt: true, isDemo: true,
          trainee: { select: { name: true } },
          trainingOrganization: { select: { name: true } },
        },
      }),
    ]);
    return NextResponse.json({
      flags: {
        ecosystemOrgPagesEnabled: settings?.ecosystemOrgPagesEnabled ?? false,
        ecosystemEducationEnabled: settings?.ecosystemEducationEnabled ?? false,
        ecosystemFeedEnabled: settings?.ecosystemFeedEnabled ?? false,
      },
      organizations: orgs,
      posts: posts.map((p) => ({ ...p, traineeName: p.trainee.name, organizationName: p.trainingOrganization.name, trainee: undefined, trainingOrganization: undefined })),
    });
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = FlagsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...parsed.data },
      update: parsed.data,
      select: { ecosystemOrgPagesEnabled: true, ecosystemEducationEnabled: true, ecosystemFeedEnabled: true },
    });
    return NextResponse.json({ flags: settings });
  });
}
