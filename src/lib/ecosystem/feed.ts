import { prisma } from "@/lib/prisma";
import type { EducationVideoCardData } from "@/components/ecosystem/EducationVideoCard";
import { FeedEntry, FeedType, rankFeed } from "./feedCore";
import { CARD_SELECT, PUBLIC_POST_WHERE, toCard } from "./queries";

export interface Viewer {
  traineeId: string | null;
  /** The trainee has opted in to being discoverable, which also unlocks browsing jobs. */
  canBrowseJobs: boolean;
}

export type FeedItem =
  | (FeedEntry & { type: "learn"; video: EducationVideoCardData })
  | (FeedEntry & { type: "organization"; org: { name: string; slug: string; logoUrl: string | null; tagline: string | null; location: string | null; verified: boolean } })
  | (FeedEntry & { type: "job"; job: { id: string; title: string; company: string; closingDate: Date } })
  | (FeedEntry & { type: "project"; project: { id: string; title: string; description: string | null; founderName: string; coverUrl: string | null } });

/** Who the signed-in trainee is, for personalizing the feed. Anyone else is an anonymous visitor. */
export async function resolveViewer(session: { userId: string; role: string } | null): Promise<Viewer> {
  if (!session || session.role !== "TRAINEE") return { traineeId: null, canBrowseJobs: false };
  const t = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { id: true, publiclyDiscoverable: true } });
  return { traineeId: t?.id ?? null, canBrowseJobs: !!t?.publiclyDiscoverable };
}

/**
 * Builds the mixed feed. Public content (videos, organizations, showcase
 * projects) is visible to everyone; jobs are shown only to a signed-in,
 * discoverable trainee — the same rule as the trainee job board. Pitches
 * are deliberately absent: they are investor-only and do not belong on a
 * public page.
 */
export async function buildFeed(types: FeedType[], viewer: Viewer, limit: number): Promise<FeedItem[]> {
  const followed = new Set<string>(
    viewer.traineeId
      ? (await prisma.organizationFollow.findMany({ where: { traineeId: viewer.traineeId }, select: { trainingOrganizationId: true } })).map((f) => f.trainingOrganizationId)
      : []
  );
  const items: FeedItem[] = [];

  if (types.includes("learn")) {
    const rows = await prisma.educationPost.findMany({ where: PUBLIC_POST_WHERE, orderBy: { publishedAt: "desc" }, take: 40, select: { ...CARD_SELECT, trainingOrganizationId: true } });
    for (const r of rows) {
      items.push({ key: `learn:${r.id}`, type: "learn", at: r.publishedAt ?? new Date(0), followed: followed.has(r.trainingOrganizationId), video: toCard(r) });
    }
  }
  if (types.includes("organization")) {
    const orgs = await prisma.trainingOrganization.findMany({
      where: { approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true, verified: true } } },
      take: 12,
      select: { id: true, name: true, logoUrl: true, publicProfile: { select: { slug: true, tagline: true, location: true, verified: true, updatedAt: true } } },
    });
    for (const o of orgs) {
      const p = o.publicProfile!;
      items.push({
        key: `org:${o.id}`, type: "organization", at: p.updatedAt, followed: followed.has(o.id),
        org: { name: o.name, slug: p.slug, logoUrl: o.logoUrl, tagline: p.tagline, location: p.location, verified: p.verified },
      });
    }
  }
  if (types.includes("job") && viewer.canBrowseJobs) {
    const jobs = await prisma.jobPosting.findMany({
      where: { status: "APPROVED", closingDate: { gt: new Date() }, employer: { approvalState: "APPROVED" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, closingDate: true, createdAt: true, employer: { select: { companyName: true } } },
    });
    for (const j of jobs) {
      items.push({ key: `job:${j.id}`, type: "job", at: j.createdAt, job: { id: j.id, title: j.title, company: j.employer.companyName, closingDate: j.closingDate } });
    }
  }
  if (types.includes("project")) {
    const projects = await prisma.project.findMany({
      where: { listedInShowcase: true, showcaseStatus: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 12,
      select: { id: true, title: true, description: true, reviewedAt: true, trainee: { select: { name: true } }, media: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 1, select: { url: true } } },
    });
    for (const p of projects) {
      items.push({
        key: `project:${p.id}`, type: "project", at: p.reviewedAt ?? new Date(0),
        project: { id: p.id, title: p.title, description: p.description, founderName: p.trainee.name, coverUrl: p.media[0]?.url ?? null },
      });
    }
  }
  return rankFeed(items, limit);
}
