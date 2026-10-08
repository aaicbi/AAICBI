import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags, type EcosystemFlags } from "@/lib/ecosystem/flags";
import { listDiscoverableOrganizations } from "@/lib/ecosystem/orgDiscovery";
import { listUpcomingEvents } from "@/lib/ecosystem/events";
import { listTrendingVideos, PUBLIC_POST_WHERE } from "@/lib/ecosystem/queries";
import { getEffectivePriceKobo } from "@/lib/coursePricing";
import { composeView, excerpt, SHOW } from "@/lib/landing/core";
import { openJobWhere, publicTraineeWhere } from "@/lib/landing/publicWhere";
import { ALL_SAMPLES } from "@/lib/landing/samples";
import type { LandingEvent, LandingJob, LandingOrg, LandingProgram, LandingReal, LandingTrainee, LandingVideo, LandingView, SkillTrend } from "@/lib/landing/types";

/**
 * Real, public data for the landing page, and the one place that decides
 * what counts as public:
 *  - programs: PUBLISHED courses, the same set the public catalogue shows;
 *  - jobs: APPROVED, unexpired postings of APPROVED employers, the same
 *    filter the trainee job board uses, minus anything private;
 *  - organizations, events, videos: only those with a public page switched
 *    on, via the existing ecosystem helpers;
 *  - trainees: only those who set their profile visibility to PUBLIC, with
 *    a username and a verified email. Never contact details.
 * Demo rows (isDemo) are left out on a production deployment so seeded
 * demo data can never pass for real activity.
 *
 * Each section is fetched on its own and fails on its own: one broken
 * query leaves that section empty, not the whole page.
 */

const EXCLUDE_DEMO = process.env.VERCEL_ENV === "production";

const FORMAT_LABEL: Record<string, string> = { SELF_PACED: "Self-paced", INSTRUCTOR_LED: "Instructor-led", HYBRID: "Hybrid" };
const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

function naira(kobo: number): string {
  return (kobo / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function demoOrgSlugs(): Promise<Set<string>> {
  if (!EXCLUDE_DEMO) return new Set();
  const rows = await prisma.organizationPublicProfile.findMany({ where: { trainingOrganization: { isDemo: true } }, select: { slug: true } });
  return new Set(rows.map((r) => r.slug));
}

async function loadPrograms(flags: EcosystemFlags): Promise<{ items: LandingProgram[]; count: number }> {
  const where = { status: "PUBLISHED" as const };
  const [courses, count] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: SHOW.programs,
      select: {
        id: true, title: true, description: true, category: true, level: true, durationDisplay: true, trainingFormat: true,
        isFree: true, priceKobo: true, discountPercent: true, createdAt: true, createdById: true,
      },
    }),
    prisma.course.count({ where }),
  ]);
  const ownerIds = [...new Set(courses.map((c) => c.createdById))];
  const orgs = ownerIds.length
    ? await prisma.trainingOrganization.findMany({
        where: { staffUserId: { in: ownerIds }, approvalState: "APPROVED" },
        select: { name: true, staffUserId: true, publicProfile: { select: { slug: true, publicEnabled: true } } },
      })
    : [];
  const orgByOwner = new Map(orgs.map((o) => [o.staffUserId, o]));
  const items = courses.map((c): LandingProgram => {
    const org = orgByOwner.get(c.createdById);
    const effective = getEffectivePriceKobo(c);
    return {
      id: c.id, title: c.title, description: excerpt(c.description, 140) || null, category: c.category,
      level: c.level ? LEVEL_LABEL[c.level] ?? null : null, duration: c.durationDisplay,
      format: c.trainingFormat ? FORMAT_LABEL[c.trainingFormat] ?? null : null,
      priceLabel: c.isFree ? "Free" : effective != null ? naira(effective) : null,
      organizationName: org?.name ?? null,
      organizationSlug: flags.orgPages && org?.publicProfile?.publicEnabled ? org.publicProfile.slug : null,
      href: `/courses/${c.id}`, at: c.createdAt.toISOString(), isSample: false,
    };
  });
  return { items, count };
}

const OPEN_JOB_WHERE = () => openJobWhere();

async function loadJobs(): Promise<{ items: LandingJob[]; count: number }> {
  const [rows, count] = await Promise.all([
    prisma.jobPosting.findMany({
      where: OPEN_JOB_WHERE(),
      orderBy: { createdAt: "desc" },
      take: SHOW.jobs,
      select: {
        id: true, title: true, description: true, closingDate: true, createdAt: true,
        employer: { select: { companyName: true } },
        skills: { select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.jobPosting.count({ where: OPEN_JOB_WHERE() }),
  ]);
  return {
    count,
    items: rows.map((j): LandingJob => ({
      id: j.id, title: j.title, company: j.employer.companyName, summary: excerpt(j.description, 140),
      skills: j.skills.map((s) => s.skill.name).slice(0, 4), closingDate: j.closingDate.toISOString(),
      href: `/jobs/${j.id}`, at: j.createdAt.toISOString(), isSample: false,
    })),
  };
}

async function loadOrganizations(): Promise<{ items: LandingOrg[]; count: number }> {
  const demo = await demoOrgSlugs();
  const all = (await listDiscoverableOrganizations("")).filter((o) => !demo.has(o.slug));
  const created = all.length
    ? await prisma.organizationPublicProfile.findMany({ where: { slug: { in: all.map((o) => o.slug) } }, select: { slug: true, createdAt: true } })
    : [];
  const createdBySlug = new Map(created.map((c) => [c.slug, c.createdAt.toISOString()]));
  return {
    count: all.length,
    items: all.slice(0, SHOW.organizations).map((o): LandingOrg => ({
      id: o.id, name: o.name, slug: o.slug, logoUrl: o.logoUrl, tagline: o.tagline, location: o.location, verified: o.verified,
      featured: o.featured, badges: o.badges, skills: o.skills.slice(0, 4), programCount: o.programCount, videoCount: o.videoCount,
      href: `/organizations/${o.slug}`, at: createdBySlug.get(o.slug) ?? null, isSample: false,
    })),
  };
}

async function loadEvents(): Promise<LandingEvent[]> {
  const demo = await demoOrgSlugs();
  const events = (await listUpcomingEvents({ take: 12 })).filter((e) => !demo.has(e.organizationSlug));
  return events.slice(0, SHOW.events).map((e): LandingEvent => ({
    id: e.id, title: e.title, startsAt: e.startsAt.toISOString(), locationText: e.locationText, organizationName: e.organizationName,
    href: "/events", isSample: false,
  }));
}

async function loadVideos(): Promise<{ items: LandingVideo[]; count: number }> {
  const demo = await demoOrgSlugs();
  const cards = (await listTrendingVideos(SHOW.videos + 4)).filter((c) => !c.organizationSlug || !demo.has(c.organizationSlug)).slice(0, SHOW.videos);
  const [published, count] = await Promise.all([
    cards.length ? prisma.educationPost.findMany({ where: { id: { in: cards.map((c) => c.id) } }, select: { id: true, publishedAt: true } }) : Promise.resolve([]),
    prisma.educationPost.count({ where: { ...PUBLIC_POST_WHERE, ...(EXCLUDE_DEMO ? { isDemo: false } : {}) } }),
  ]);
  const at = new Map(published.map((p) => [p.id, p.publishedAt?.toISOString() ?? null]));
  return { count, items: cards.map((card): LandingVideo => ({ card, href: `/learn/${card.id}`, at: at.get(card.id) ?? null, isSample: false })) };
}

async function loadTrainees(): Promise<{ items: LandingTrainee[]; count: number }> {
  const where = publicTraineeWhere();
  const [rows, count] = await Promise.all([
    prisma.trainee.findMany({
      where, orderBy: { createdAt: "desc" }, take: SHOW.trainees,
      select: {
        id: true, name: true, avatarUrl: true, username: true, location: true, openToWork: true,
        skills: { take: 4, select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.trainee.count({ where }),
  ]);
  return {
    count,
    items: rows.map((t, i): LandingTrainee => ({
      id: t.id, name: t.name, username: t.username ?? "", avatarUrl: t.avatarUrl, location: t.location, openToWork: t.openToWork,
      skills: t.skills.map((s) => s.skill.name), href: `/profile/u/${t.username}`, avatarSeed: i + 1, isSample: false,
    })),
  };
}

/** The skills most used across published programs, open jobs and published videos. Real counts only. */
async function loadSkillTrends(): Promise<SkillTrend[]> {
  const [courseSkills, jobSkills, videoSkills] = await Promise.all([
    prisma.courseSkill.groupBy({ by: ["skillId"], where: { course: { status: "PUBLISHED" } }, _count: { skillId: true } }),
    prisma.jobPostingSkill.groupBy({ by: ["skillId"], where: { jobPosting: OPEN_JOB_WHERE() }, _count: { skillId: true } }),
    prisma.educationPostSkill.groupBy({ by: ["skillId"], where: { post: PUBLIC_POST_WHERE }, _count: { skillId: true } }),
  ]);
  const totals = new Map<string, number>();
  for (const list of [courseSkills, jobSkills, videoSkills]) {
    for (const row of list) totals.set(row.skillId, (totals.get(row.skillId) ?? 0) + row._count.skillId);
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length === 0) return [];
  const names = await prisma.skill.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true } });
  const nameById = new Map(names.map((n) => [n.id, n.name]));
  return top.flatMap(([id, count]) => (nameById.has(id) ? [{ name: nameById.get(id)!, count }] : []));
}

async function loadReal(flags: EcosystemFlags): Promise<LandingReal> {
  const [programs, jobs, orgs, events, videos, trainees, skills] = await Promise.all([
    safe(() => loadPrograms(flags), { items: [], count: 0 }),
    flags.publicJobs ? safe(loadJobs, { items: [], count: 0 }) : { items: [], count: 0 },
    flags.orgPages ? safe(loadOrganizations, { items: [], count: 0 }) : { items: [], count: 0 },
    flags.orgPages ? safe(loadEvents, []) : [],
    flags.orgPages && flags.education ? safe(loadVideos, { items: [], count: 0 }) : { items: [], count: 0 },
    flags.publicTrainees ? safe(loadTrainees, { items: [], count: 0 }) : { items: [], count: 0 },
    safe(loadSkillTrends, []),
  ]);
  return {
    programs: programs.items, jobs: jobs.items, organizations: orgs.items, trainees: trainees.items, events, videos: videos.items, skills,
    stats: { organizations: orgs.count, programs: programs.count, jobs: jobs.count, videos: videos.count, trainees: trainees.count },
  };
}

/** Plain JSON in, plain JSON out, so it can sit behind unstable_cache. */
const loadRealCached = unstable_cache(async (flagsJson: string) => loadReal(JSON.parse(flagsJson) as EcosystemFlags), ["landing-real-v1"], {
  revalidate: 300,
  tags: ["landing"],
});

/**
 * The landing page's data: real content (cached five minutes, and cleared
 * at once when SUPER_ADMIN changes a switch) plus labelled placeholders
 * where a section is thin. Returns null when the landing switch is off,
 * so the page falls back to the original landing page.
 */
export async function getLandingView(): Promise<{ view: LandingView; flags: EcosystemFlags } | null> {
  const flags = await getEcosystemFlags();
  if (!flags.landing) return null;
  const real = await safe(() => loadRealCached(JSON.stringify(flags)), emptyReal());
  return { view: composeView(real, ALL_SAMPLES, { placeholders: flags.placeholders }), flags };
}

export function emptyReal(): LandingReal {
  return {
    programs: [], jobs: [], organizations: [], trainees: [], events: [], videos: [], skills: [],
    stats: { organizations: 0, programs: 0, jobs: 0, videos: 0, trainees: 0 },
  };
}

export { OPEN_JOB_WHERE, publicTraineeWhere };
