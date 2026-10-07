import { prisma } from "@/lib/prisma";
import type { EducationVideoCardData } from "@/components/ecosystem/EducationVideoCard";
import { ProgramCandidate, VideoContext, rankPrograms } from "./recommendCore";
import { diversify } from "./feedCore";
import { CARD_SELECT, PUBLIC_POST_WHERE, toCard } from "./queries";

const PUBLIC_COURSE_ORG = {
  trainingOrgAsStaffUser: { is: { approvalState: "APPROVED" as const, publicProfile: { is: { publicEnabled: true } } } },
};

/**
 * Programs worth suggesting under a video: published courses of
 * organizations with a public page that share a skill with the video, are
 * in its category, or are the program the video was tagged with. Ranked by
 * relevance only (see scoreProgram) — no organization is favored for its
 * size, activity or payment.
 */
export async function recommendPrograms(video: VideoContext, limit = 2): Promise<ProgramCandidate[]> {
  const or: object[] = [];
  if (video.skills.length) or.push({ skills: { some: { skill: { name: { in: video.skills, mode: "insensitive" } } } } });
  if (video.category) or.push({ category: { equals: video.category, mode: "insensitive" } });
  if (video.courseId) or.push({ id: video.courseId });
  if (!or.length) return [];

  const rows = await prisma.course.findMany({
    where: { status: "PUBLISHED", createdBy: PUBLIC_COURSE_ORG, OR: or },
    take: 100,
    select: {
      id: true, title: true, category: true, durationDisplay: true,
      skills: { select: { skill: { select: { name: true } } } },
      createdBy: { select: { trainingOrgAsStaffUser: { select: { id: true, name: true, publicProfile: { select: { slug: true } } } } } },
    },
  });
  const candidates: ProgramCandidate[] = rows.flatMap((r) => {
    const org = r.createdBy.trainingOrgAsStaffUser;
    if (!org) return [];
    return [{
      id: r.id, title: r.title, organizationId: org.id, organizationName: org.name, organizationSlug: org.publicProfile?.slug ?? null,
      category: r.category, durationDisplay: r.durationDisplay, skills: r.skills.map((s) => s.skill.name),
    }];
  });
  return rankPrograms(video, candidates, limit);
}

/** Other published videos that share at least one skill, one per organization at most twice. */
export async function similarVideos(postId: string, skills: string[], take = 3): Promise<EducationVideoCardData[]> {
  if (!skills.length) return [];
  const rows = await prisma.educationPost.findMany({
    where: { ...PUBLIC_POST_WHERE, id: { not: postId }, skills: { some: { skill: { name: { in: skills, mode: "insensitive" } } } } },
    orderBy: { publishedAt: "desc" },
    take: 12,
    select: CARD_SELECT,
  });
  return diversify(rows, (r) => r.trainingOrganization.name, 2).slice(0, take).map(toCard);
}

/** Open, approved jobs asking for any of these skills. */
export async function jobsForSkills(skills: string[], take = 3) {
  if (!skills.length) return [];
  return prisma.jobPosting.findMany({
    where: {
      status: "APPROVED", closingDate: { gt: new Date() }, employer: { approvalState: "APPROVED" },
      skills: { some: { skill: { name: { in: skills, mode: "insensitive" } } } },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, title: true, employer: { select: { companyName: true } } },
  });
}
