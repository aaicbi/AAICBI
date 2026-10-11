import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import type { EcosystemFlags } from "@/lib/ecosystem/flags";
import { listPublicVideos } from "@/lib/ecosystem/queries";
import { listUpcomingEvents } from "@/lib/ecosystem/events";
import { openJobWhere } from "@/lib/landing/publicWhere";
import { searchProfiles, type ProfileHit, type ProfileKindFilter } from "@/lib/profiles/profileSearch";
import { searchPosts, type Actor, type FeedPost } from "@/lib/posts/interactions";
import { ALL_PREVIEW, PAGE_SIZE, orderHits, pageOf, rankText, type SearchParams } from "@/lib/ecosystem/searchCore";

const has = (q: string) => ({ contains: q, mode: "insensitive" as const });
const PUBLIC_ORG = { approvalState: "APPROVED" as const, publicProfile: { is: { publicEnabled: true } } };
const POOL = 60; // how many candidates a kind looks at before ranking and paging

export interface Paged<T> { items: T[]; hasMore: boolean }
export interface JobHit { id: string; title: string; company: string; summary: string; skills: string[]; closingDate: string; createdAt: string; rank: number; at: number }
export interface ProgramHit { id: string; title: string; category: string | null; durationDisplay: string | null; organizationName: string; organizationSlug: string | null; rank: number; at: number }

export type VideoHit = Awaited<ReturnType<typeof listPublicVideos>>[number];
export type EventHit = Awaited<ReturnType<typeof listUpcomingEvents>>[number];

export interface SearchResults {
  people?: Paged<ProfileHit>;
  organizations?: Paged<ProfileHit>;
  employers?: Paged<ProfileHit>;
  investors?: Paged<ProfileHit>;
  startups?: Paged<ProfileHit>;
  jobs?: Paged<JobHit>;
  programs?: Paged<ProgramHit>;
  posts?: Paged<FeedPost>;
  videos?: Paged<VideoHit>;
  events?: Paged<EventHit>;
}

const excerpt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/** Open jobs of approved employers (the same rule as the public job board), ranked and paged. */
async function searchJobs(p: SearchParams, size: number, page: number): Promise<Paged<JobHit>> {
  const q = p.q;
  const rows = await prisma.jobPosting.findMany({
    where: {
      ...openJobWhere(),
      AND: [
        ...(q ? [{ OR: [{ title: has(q) }, { description: has(q) }, { employer: { companyName: has(q) } }, { skills: { some: { skill: { name: has(q) } } } }] }] : []),
        ...(p.skill ? [{ skills: { some: { skill: { name: has(p.skill) } } } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: POOL,
    select: { id: true, title: true, description: true, closingDate: true, createdAt: true, employer: { select: { companyName: true } }, skills: { select: { skill: { select: { name: true } } } } },
  });
  const hits: JobHit[] = rows.map((j) => {
    const skills = j.skills.map((s) => s.skill.name);
    return { id: j.id, title: j.title, company: j.employer.companyName, summary: excerpt(j.description, 160), skills: skills.slice(0, 4), closingDate: j.closingDate.toISOString(), createdAt: j.createdAt.toISOString(), rank: q ? rankText(q, [j.title, j.employer.companyName, ...skills, j.description]) : 50, at: j.createdAt.getTime() };
  });
  return pageOf(orderHits(hits, p.sort), page, size);
}

/** Published programs of organizations that have a public page. `industry` narrows by category. */
async function searchPrograms(p: SearchParams, size: number, page: number): Promise<Paged<ProgramHit>> {
  const q = p.q;
  const orgs = await prisma.trainingOrganization.findMany({ where: { ...PUBLIC_ORG, staffUserId: { not: null } }, select: { name: true, staffUserId: true, publicProfile: { select: { slug: true } } } });
  const byStaff = new Map(orgs.map((o) => [o.staffUserId!, o]));
  const courses = await prisma.course.findMany({
    where: {
      status: "PUBLISHED", createdById: { in: [...byStaff.keys()] },
      AND: [
        ...(q ? [{ OR: [{ title: has(q) }, { category: has(q) }, { skills: { some: { skill: { name: has(q) } } } }] }] : []),
        ...(p.industry ? [{ category: has(p.industry) }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: POOL,
    select: { id: true, title: true, category: true, durationDisplay: true, createdById: true, createdAt: true },
  });
  const hits: ProgramHit[] = courses.map((c) => {
    const org = byStaff.get(c.createdById);
    return { id: c.id, title: c.title, category: c.category, durationDisplay: c.durationDisplay, organizationName: org?.name ?? "", organizationSlug: org?.publicProfile?.slug ?? null, rank: q ? rankText(q, [c.title, c.category, org?.name]) : 50, at: c.createdAt.getTime() };
  });
  return pageOf(orderHits(hits, p.sort), page, size);
}

/**
 * Everything the search can find, for the request. On "All" every kind shows a short preview and says whether there is more;
 * on one kind that kind shows a full page. Each kind is only searched when its feature switch is on, and every query applies the
 * same public, approved and visibility rules as the page it would link to; nothing private, pending, rejected or draft is read.
 */
export async function runSearch(p: SearchParams, flags: EcosystemFlags, viewer: SessionPayload | null, actor: Actor | null): Promise<SearchResults> {
  const all = p.kind === "all";
  const want = (k: SearchParams["kind"]) => all || p.kind === k;
  const size = all ? ALL_PREVIEW : PAGE_SIZE;
  const page = all ? 1 : p.page;
  // On "All" the narrowing filters are not offered, so only the word counts; with a kind chosen, its filters apply.
  const profiles = (k: ProfileKindFilter) => searchProfiles({ q: p.q, kinds: [k], skill: all ? null : p.skill, location: all ? null : p.location, industry: all ? null : p.industry, sort: p.sort, page, size, browse: !all, viewer });
  const needsWord = all && !p.q; // "All" with no word has nothing to look for
  if (needsWord) return {};

  const [people, organizations, employers, investors, startups, jobs, programs, posts, videos, events] = await Promise.all([
    want("people") && flags.publicTrainees ? profiles("PERSON") : undefined,
    want("organizations") && flags.orgPages ? profiles("TRAINING_ORG") : undefined,
    want("employers") && flags.orgPages ? profiles("EMPLOYER") : undefined,
    want("investors") && flags.orgPages ? profiles("INVESTOR") : undefined,
    want("startups") && flags.orgPages ? profiles("STARTUP") : undefined,
    want("jobs") && flags.publicJobs ? searchJobs(p, size, page) : undefined,
    want("programs") && flags.orgPages ? searchPrograms(p, size, page) : undefined,
    want("posts") && flags.feed
      ? searchPosts(p.q, actor, size + 1, { type: all ? null : p.type, skip: (page - 1) * size }).then((rows) => ({ items: rows.slice(0, size), hasMore: rows.length > size }))
      : undefined,
    want("videos") && flags.education && flags.orgPages
      ? listPublicVideos(p.q ? { OR: [{ title: has(p.q) }, { topic: has(p.q) }, { description: has(p.q) }, { skills: { some: { skill: { name: has(p.q) } } } }] } : {}, page * size + 1).then((rows) => pageOf(rows, page, size))
      : undefined,
    want("events") && flags.orgPages && p.q ? listUpcomingEvents({ q: p.q, take: page * size + 1 }).then((rows) => pageOf(rows, page, size)) : undefined,
  ]);
  return { people, organizations, employers, investors, startups, jobs, programs, posts, videos, events };
}

/** How many results came back in total, for the empty state. */
export function totalHits(r: SearchResults): number {
  return Object.values(r).reduce((n, v) => n + (v ? v.items.length : 0), 0);
}
