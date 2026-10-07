import { prisma } from "@/lib/prisma";
import { pickFeatured } from "@/lib/ecosystem/visibilityCore";
import { getRankingConfig, rateOrganizations } from "@/lib/ecosystem/visibility";

export interface DiscoverableOrg {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  location: string | null;
  verified: boolean;
  featured: boolean;
  badges: string[];
  skills: string[];
  programCount: number;
  videoCount: number;
}

/** Case-insensitive "does any skill contain this text". An empty query matches everything. */
export function matchesSkill(skills: string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || skills.some((s) => s.toLowerCase().includes(q));
}

/**
 * Public, non-sensitive facts about organizations with a public page, for
 * approved employers and investors: what they teach, how active they are
 * (badges only, never the score) and where to read more. Featured first,
 * then by score. Contact details and trainee lists are never selected.
 */
export async function listDiscoverableOrganizations(skill = ""): Promise<DiscoverableOrg[]> {
  const cfg = await getRankingConfig();
  const rated = await rateOrganizations(cfg);
  const featuredIds = new Set(pickFeatured(rated, cfg).map((r) => r.id));
  if (rated.length === 0) return [];

  const orgs = await prisma.trainingOrganization.findMany({
    where: { id: { in: rated.map((r) => r.id) } },
    select: {
      id: true, logoUrl: true, staffUserId: true,
      publicProfile: { select: { tagline: true, location: true } },
      _count: { select: { educationPosts: { where: { status: "PUBLISHED" } } } },
    },
  });

  const out: Array<DiscoverableOrg & { score: number }> = [];
  for (const o of orgs) {
    const r = rated.find((x) => x.id === o.id)!;
    const courses = o.staffUserId
      ? await prisma.course.findMany({ where: { createdById: o.staffUserId }, select: { skills: { select: { skill: { select: { name: true } } } } } })
      : [];
    const skills = [...new Set(courses.flatMap((c) => c.skills.map((s) => s.skill.name)))].sort();
    if (!matchesSkill(skills, skill)) continue;
    out.push({
      id: o.id, name: r.name, slug: r.slug, logoUrl: o.logoUrl,
      tagline: o.publicProfile?.tagline ?? null, location: o.publicProfile?.location ?? null,
      verified: r.verified, featured: featuredIds.has(o.id), badges: r.badges.filter((b) => b !== "verified"),
      skills: skills.slice(0, 10), programCount: courses.length, videoCount: o._count.educationPosts, score: r.score,
    });
  }
  out.sort((a, b) => Number(b.featured) - Number(a.featured) || b.score - a.score || a.name.localeCompare(b.name));
  return out.map(({ score: _score, ...rest }) => rest);
}
