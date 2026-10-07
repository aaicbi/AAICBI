import { prisma } from "@/lib/prisma";
import type { EducationVideoCardData } from "@/components/ecosystem/EducationVideoCard";
import { diversify, trendingScore } from "@/lib/ecosystem/feedCore";

/** Only a PUBLISHED video whose organization has a public page switched on is ever shown. */
export const PUBLIC_POST_WHERE = {
  status: "PUBLISHED" as const,
  trainingOrganization: { approvalState: "APPROVED" as const, publicProfile: { is: { publicEnabled: true } } },
};

export const CARD_SELECT = {
  id: true,
  title: true,
  thumbnailUrl: true,
  category: true,
  viewCount: true,
  publishedAt: true,
  _count: { select: { reactions: { where: { kind: "LIKE" as const } } } },
  course: { select: { title: true } },
  trainee: { select: { name: true } },
  skills: { select: { skill: { select: { name: true } } } },
  trainingOrganization: { select: { name: true, publicProfile: { select: { slug: true, verified: true } } } },
} as const;

type CardRow = Awaited<ReturnType<typeof findCardRows>>[number];

function findCardRows(where: object, take: number) {
  return prisma.educationPost.findMany({
    where: { ...PUBLIC_POST_WHERE, ...where },
    orderBy: { publishedAt: "desc" },
    take,
    select: CARD_SELECT,
  });
}

export function toCard(row: CardRow): EducationVideoCardData {
  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    category: row.category,
    viewCount: row.viewCount,
    likeCount: row._count.reactions,
    skills: row.skills.map((s) => s.skill.name),
    traineeName: row.trainee.name,
    programLabel: row.course?.title ?? row.category,
    organizationName: row.trainingOrganization.name,
    organizationSlug: row.trainingOrganization.publicProfile?.slug ?? null,
    organizationVerified: !!row.trainingOrganization.publicProfile?.verified,
  };
}

export async function listPublicVideos(where: object = {}, take = 24): Promise<EducationVideoCardData[]> {
  return (await findCardRows(where, take)).map(toCard);
}

/** Trending Education: recent published videos ranked by dampened engagement, at most two per organization. */
export async function listTrendingVideos(take = 6): Promise<EducationVideoCardData[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await prisma.educationPost.findMany({
    where: { ...PUBLIC_POST_WHERE, publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: { ...CARD_SELECT, _count: { select: { reactions: true } } },
  });
  // Saves are counted separately from likes; one extra grouped query.
  const saves = await prisma.educationPostReaction.groupBy({
    by: ["postId"],
    where: { kind: "SAVE", postId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const saveCount = new Map(saves.map((s) => [s.postId, s._count._all]));
  const now = Date.now();
  const scored = rows
    .map((r) => ({
      row: r,
      score: trendingScore({
        views: r.viewCount,
        likes: r._count.reactions - (saveCount.get(r.id) ?? 0),
        saves: saveCount.get(r.id) ?? 0,
        ageDays: r.publishedAt ? (now - r.publishedAt.getTime()) / 86_400_000 : 90,
      }),
    }))
    .sort((a, b) => b.score - a.score);
  return diversify(scored, (x) => x.row.trainingOrganization.name, 2)
    .slice(0, take)
    .map((x) => toCard({ ...x.row, _count: { reactions: x.row._count.reactions - (saveCount.get(x.row.id) ?? 0) } }));
}
