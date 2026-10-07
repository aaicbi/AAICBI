import { prisma } from "@/lib/prisma";
import { orgTraineeWhere } from "@/lib/ecosystem/orgScope";
import {
  badgesFor, computeVisibility, parseRankingConfig, pickFeatured,
  type BadgeKey, type OrgSignals, type RankingConfig, type ScoreResult,
} from "@/lib/ecosystem/visibilityCore";

export async function getRankingConfig(): Promise<RankingConfig> {
  try {
    const row = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { ecosystemRankingConfig: true } });
    return parseRankingConfig(row?.ecosystemRankingConfig);
  } catch {
    return parseRankingConfig(null);
  }
}

export interface RatedOrg {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  publishedVideos: number;
  score: number;
  result: ScoreResult;
  badges: BadgeKey[];
}

/**
 * Scores every organization with a public page. Computed on demand from
 * existing tables (no snapshot table, no scheduled job), so it cannot
 * drift from the data and adds nothing to the existing infrastructure.
 * Demo organizations are scored too, only so the demo world has something
 * to show; they are flagged and never mixed into real analytics.
 */
export async function rateOrganizations(cfg?: RankingConfig, now = new Date()): Promise<RatedOrg[]> {
  const config = cfg ?? (await getRankingConfig());
  const since = new Date(now.getTime() - config.windowWeeks * 7 * 24 * 3600 * 1000);
  const orgs = await prisma.trainingOrganization.findMany({
    where: { approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } } },
    select: { id: true, name: true, staffUserId: true, publicProfile: { select: { slug: true, verified: true } }, _count: { select: { followers: true } } },
  });

  const rated: RatedOrg[] = [];
  for (const org of orgs) {
    const posts = await prisma.educationPost.findMany({
      where: { trainingOrganizationId: org.id, status: "PUBLISHED", publishedAt: { gte: since } },
      select: { id: true, traineeId: true, publishedAt: true, description: true, courseId: true, viewCount: true, _count: { select: { skills: true } } },
    });
    const postIds = posts.map((p) => p.id);
    const reactions = postIds.length
      ? await prisma.educationPostReaction.findMany({ where: { postId: { in: postIds } }, select: { traineeId: true } })
      : [];
    const engagerIds = [...new Set(reactions.map((r) => r.traineeId))];
    // Own members never lift their own organization.
    const ownMembers = engagerIds.length && org.staffUserId
      ? await prisma.trainee.findMany({ where: { id: { in: engagerIds }, ...orgTraineeWhere(org.staffUserId) }, select: { id: true } })
      : [];
    const own = new Set(ownMembers.map((t) => t.id));
    const authors = new Set(posts.map((p) => p.traineeId));

    const courses = org.staffUserId
      ? await prisma.course.findMany({ where: { createdById: org.staffUserId }, select: { id: true, _count: { select: { skills: true } } } })
      : [];
    const certificatesIssued = courses.length
      ? await prisma.certificate.count({ where: { courseId: { in: courses.map((c) => c.id) }, revokedAt: null, issuedAt: { gte: since } } })
      : 0;

    const verified = !!org.publicProfile?.verified;
    const signals: OrgSignals = {
      posts: posts.map((p) => ({
        publishedAt: p.publishedAt ?? now,
        hasDescription: (p.description ?? "").trim().length >= 40,
        skillCount: p._count.skills,
        linkedProgram: !!p.courseId,
        traineeId: p.traineeId,
      })),
      uniqueEngagers: engagerIds.filter((id) => !own.has(id) && !authors.has(id)).length,
      views: posts.reduce((n, p) => n + p.viewCount, 0),
      followers: org._count.followers,
      certificatesIssued,
      programCount: courses.length,
      programsWithSkills: courses.filter((c) => c._count.skills > 0).length,
      verified,
    };
    const result = computeVisibility(signals, config, now);
    rated.push({
      id: org.id,
      name: org.name,
      slug: org.publicProfile!.slug,
      verified,
      publishedVideos: posts.length,
      score: result.score,
      result,
      badges: badgesFor(signals, result, now),
    });
  }
  return rated;
}

export async function featuredOrganizations(): Promise<{ featured: RatedOrg[]; all: RatedOrg[] }> {
  const cfg = await getRankingConfig();
  const all = await rateOrganizations(cfg);
  return { featured: pickFeatured(all, cfg), all };
}
