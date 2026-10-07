import { prisma } from "@/lib/prisma";
import type { EducationVideoCardData } from "@/components/ecosystem/EducationVideoCard";

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
