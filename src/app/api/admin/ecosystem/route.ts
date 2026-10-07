import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { getRankingConfig, rateOrganizations } from "@/lib/ecosystem/visibility";
import { RankingConfigSchema, pickFeatured } from "@/lib/ecosystem/visibilityCore";

export const dynamic = "force-dynamic";

const FlagsSchema = z.object({
  ecosystemOrgPagesEnabled: z.boolean().optional(),
  ecosystemEducationEnabled: z.boolean().optional(),
  ecosystemFeedEnabled: z.boolean().optional(),
  rankingConfig: RankingConfigSchema.optional(),
});

/**
 * GET/PUT /api/admin/ecosystem — SUPER_ADMIN only. Feature switches, the
 * list of organizations with their public-profile state, and the
 * education-post moderation queue in one payload for /admin/ecosystem.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const config = await getRankingConfig();
    const [settings, orgs, posts, rated] = await Promise.all([
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
      rateOrganizations(config),
    ]);
    const featuredIds = new Set(pickFeatured(rated, config).map((r) => r.id));
    return NextResponse.json({
      rankingConfig: config,
      ratings: rated.map((r) => ({ id: r.id, name: r.name, score: r.score, components: r.result.components, publishedVideos: r.publishedVideos, badges: r.badges, featured: featuredIds.has(r.id) })).sort((a, b) => b.score - a.score),
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
    const { rankingConfig, ...flagData } = parsed.data;
    const data = { ...flagData, ...(rankingConfig ? { ecosystemRankingConfig: rankingConfig } : {}) };
    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
      select: { ecosystemOrgPagesEnabled: true, ecosystemEducationEnabled: true, ecosystemFeedEnabled: true },
    });
    return NextResponse.json({ flags: settings });
  });
}
