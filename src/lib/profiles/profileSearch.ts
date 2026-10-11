import type { Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { loadProfileView, kindLabel } from "@/lib/profiles/view";

/**
 * Searching for people and organizations by name or handle. A former handle
 * still finds its owner (the result says "formerly @old"), and every result is
 * filtered through the same visibility rules as the profile page, so search
 * never shows someone the page itself would hide.
 */
export interface PersonResult {
  handle: string;
  name: string;
  avatarUrl: string | null;
  kind: Profile["kind"];
  kindLabel: string;
  headline: string | null;
  /** Set when the match was an old handle of this person. */
  formerHandle: string | null;
}

const CANDIDATES = 40;
const LIMIT = 20;
const clean = (q: string) => q.trim().toLowerCase().replace(/^@+/, "");

export async function searchPeople(rawQuery: string, viewer: SessionPayload | null): Promise<PersonResult[]> {
  const q = clean(rawQuery);
  if (q.length < 2) return [];
  const contains = { contains: q, mode: "insensitive" as const };

  const [byHandle, byFormer, trainees, employers, orgs, staff, startups] = await Promise.all([
    prisma.profile.findMany({ where: { handle: contains }, take: CANDIDATES }),
    prisma.profileHandleHistory.findMany({ where: { handle: contains }, take: CANDIDATES }),
    prisma.trainee.findMany({ where: { name: contains }, select: { id: true }, take: CANDIDATES }),
    prisma.employer.findMany({ where: { companyName: contains }, select: { id: true }, take: CANDIDATES }),
    prisma.trainingOrganization.findMany({ where: { name: contains }, select: { id: true }, take: CANDIDATES }),
    prisma.user.findMany({ where: { name: contains, trainingOrgAsStaffUser: null }, select: { id: true }, take: CANDIDATES }),
    prisma.startup.findMany({ where: { name: contains }, select: { id: true }, take: CANDIDATES }),
  ]);

  const byName = await prisma.profile.findMany({
    where: { OR: [{ traineeId: { in: trainees.map((t) => t.id) } }, { employerId: { in: employers.map((e) => e.id) } }, { trainingOrganizationId: { in: orgs.map((o) => o.id) } }, { userId: { in: staff.map((s) => s.id) } }, { startupId: { in: startups.map((s) => s.id) } }] },
    take: CANDIDATES,
  });
  const formerProfiles = await prisma.profile.findMany({ where: { id: { in: byFormer.map((h) => h.profileId) } } });
  const formerOf = new Map<string, string>();
  for (const h of byFormer) formerOf.set(h.profileId, h.handle);

  const seen = new Map<string, Profile>();
  for (const p of [...byHandle, ...formerProfiles, ...byName]) seen.set(p.id, p);

  // Best matches first: exact handle, exact former handle, handle prefix, everything else.
  const rank = (p: Profile) => (p.handle === q ? 0 : formerOf.get(p.id) === q ? 1 : p.handle.startsWith(q) ? 2 : formerOf.get(p.id)?.startsWith(q) ? 3 : 4);
  const ordered = [...seen.values()].sort((a, b) => rank(a) - rank(b) || a.handle.localeCompare(b.handle)).slice(0, CANDIDATES);

  const out: PersonResult[] = [];
  for (const p of ordered) {
    if (out.length >= LIMIT) break;
    const v = await loadProfileView(p, viewer);
    if (!v) continue;
    // Say "formerly" only when the person was found through an old handle and not through their current one or name.
    const formerHandle = formerOf.has(p.id) && !p.handle.includes(q) ? formerOf.get(p.id)! : null;
    out.push({ handle: p.handle, name: v.name, avatarUrl: v.avatarUrl, kind: p.kind, kindLabel: kindLabel(p.kind), headline: v.headline, formerHandle });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The wider profile search used by /search and the suggestions: every kind of
// account (members, organizations, employers, investors, startups), by name,
// handle, former handle, place, skill, industry and what they do, with filters,
// ranking and paging. Same rule as above: each hit is passed through the
// profile page's own visibility check, so search never reveals a profile the
// page itself would hide (investors, for instance, have no public profile yet,
// so only their owner and staff can ever find them).
// ---------------------------------------------------------------------------

import { rankText, orderHits, pageOf, type SearchSort } from "@/lib/ecosystem/searchCore";

export type ProfileKindFilter = "PERSON" | "TRAINING_ORG" | "EMPLOYER" | "INVESTOR" | "STARTUP";

export interface ProfileHit {
  handle: string;
  name: string;
  avatarUrl: string | null;
  kind: Profile["kind"];
  kindLabel: string;
  headline: string | null;
  location: string | null;
  skills: string[];
  chips: string[];
  verified: boolean;
  formerHandle: string | null;
  rank: number;
  at: number;
}

export interface ProfileSearchOptions {
  q: string | null;
  kinds: ProfileKindFilter[];
  skill?: string | null;
  location?: string | null;
  industry?: string | null;
  sort: SearchSort;
  page: number;
  size: number;
  /** With a kind chosen and nothing typed, list the newest of that kind instead of nothing. */
  browse?: boolean;
  viewer: SessionPayload | null;
}

const CAND = 40;
const ins = (s: string) => ({ contains: s, mode: "insensitive" as const });

/** Candidate profiles for one kind: cheap database matches that the visibility check and the filters then confirm. */
async function candidates(kind: ProfileKindFilter, o: ProfileSearchOptions, q: string | null): Promise<Profile[]> {
  const skill = o.skill?.trim() || null;
  const place = o.location?.trim() || null;
  const industry = o.industry?.trim() || null;
  const signedIn = !!o.viewer;
  if (kind === "PERSON") {
    const where = {
      emailVerified: true,
      profileVisibility: { in: signedIn ? ["PUBLIC", "AUTHENTICATED"] : ["PUBLIC"] } as never,
      AND: [
        ...(q ? [{ OR: [{ name: ins(q) }, { location: ins(q) }, { username: ins(q) }, { skills: { some: { skill: { name: ins(q) } } } }] }] : []),
        ...(skill ? [{ skills: { some: { skill: { name: ins(skill) } } } }] : []),
        ...(place ? [{ location: ins(place) }] : []),
      ],
    };
    const rows = await prisma.trainee.findMany({ where, select: { id: true }, orderBy: { createdAt: "desc" }, take: CAND });
    return prisma.profile.findMany({ where: { kind: "PERSON", traineeId: { in: rows.map((r) => r.id) } } });
  }
  if (kind === "TRAINING_ORG") {
    const rows = await prisma.trainingOrganization.findMany({
      where: {
        approvalState: "APPROVED",
        publicProfile: { is: { publicEnabled: true, ...(place ? { location: ins(place) } : {}) } },
        ...(q ? { OR: [{ name: ins(q) }, { publicProfile: { is: { OR: [{ tagline: ins(q) }, { location: ins(q) }, { description: ins(q) }] } } }] } : {}),
      },
      select: { id: true }, take: CAND,
    });
    return prisma.profile.findMany({ where: { kind: "TRAINING_ORG", trainingOrganizationId: { in: rows.map((r) => r.id) } } });
  }
  if (kind === "EMPLOYER") {
    if (skill || place || industry) return []; // employers carry none of these, so a filter on them matches nobody
    const rows = await prisma.employer.findMany({
      where: { approvalState: "APPROVED", profileVisibility: { in: signedIn ? ["PUBLIC", "AUTHENTICATED"] : ["PUBLIC"] } as never, ...(q ? { companyName: ins(q) } : {}) },
      select: { id: true }, orderBy: { createdAt: "desc" }, take: CAND,
    });
    return prisma.profile.findMany({ where: { kind: "EMPLOYER", employerId: { in: rows.map((r) => r.id) } } });
  }
  if (kind === "INVESTOR") {
    if (skill || place || industry) return [];
    const rows = await prisma.investor.findMany({ where: { approvalState: "APPROVED", ...(q ? { OR: [{ name: ins(q) }, { organization: ins(q) }] } : {}) }, select: { id: true }, take: CAND });
    return prisma.profile.findMany({ where: { kind: "INVESTOR", investorId: { in: rows.map((r) => r.id) } } });
  }
  // STARTUP
  if (skill) return [];
  const rows = await prisma.startup.findMany({
    where: {
      status: "APPROVED",
      ...(industry ? { industry: ins(industry) } : {}),
      ...(place ? { location: ins(place) } : {}),
      ...(q ? { OR: [{ name: ins(q) }, { tagline: ins(q) }, { industry: ins(q) }, { location: ins(q) }, { description: ins(q) }] } : {}),
    },
    select: { id: true }, orderBy: { createdAt: "desc" }, take: CAND,
  });
  return prisma.profile.findMany({ where: { kind: "STARTUP", startupId: { in: rows.map((r) => r.id) } } });
}

/** One page of profile hits, ranked, with whether more follow. Needs at least a word or a filter. */
export async function searchProfiles(o: ProfileSearchOptions): Promise<{ items: ProfileHit[]; hasMore: boolean }> {
  const q = o.q ? clean(o.q) : null;
  if (!q && !o.skill && !o.location && !o.industry && !o.browse) return { items: [], hasMore: false };

  const groups = await Promise.all(o.kinds.map((k) => candidates(k, o, q)));
  const pool = new Map<string, Profile>();
  for (const p of groups.flat()) pool.set(p.id, p);

  // A handle (or a former handle) that matches finds its owner whatever else they have written.
  const formerOf = new Map<string, string>();
  if (q && !o.skill && !o.location && !o.industry) {
    const [byHandle, byFormer] = await Promise.all([
      prisma.profile.findMany({ where: { handle: ins(q), kind: { in: o.kinds } }, take: CAND }),
      prisma.profileHandleHistory.findMany({ where: { handle: ins(q) }, take: CAND }),
    ]);
    for (const p of byHandle) pool.set(p.id, p);
    const former = await prisma.profile.findMany({ where: { id: { in: byFormer.map((h) => h.profileId) }, kind: { in: o.kinds } } });
    for (const h of byFormer) formerOf.set(h.profileId, h.handle);
    for (const p of former) pool.set(p.id, p);
  }

  const need = o.page * o.size + 1;
  const hits: ProfileHit[] = [];
  // Look at the likeliest first (handle matches, then newest) and stop once the page and the next-page flag are certain.
  const ordered = [...pool.values()].sort((a, b) => Number(b.handle === q) - Number(a.handle === q) || b.createdAt.getTime() - a.createdAt.getTime());
  for (const p of ordered) {
    if (hits.length >= need + CAND) break;
    const v = await loadProfileView(p, o.viewer);
    if (!v) continue;
    const skills = (v.sections.find((s) => s.title === "Skills")?.items ?? []).map((i) => i.primary);
    // The filters are confirmed against what the person's own page shows.
    if (o.skill && !skills.some((s) => s.toLowerCase().includes(o.skill!.toLowerCase()))) continue;
    if (o.location && !(v.location ?? "").toLowerCase().includes(o.location.toLowerCase())) continue;
    if (o.industry && !v.chips.some((c) => c.toLowerCase().includes(o.industry!.toLowerCase()))) continue;
    const former = formerOf.get(p.id);
    const formerHandle = former && !p.handle.includes(q ?? "") ? former : null;
    const rank = q ? Math.max(rankText(q, [v.name, p.handle, v.headline, v.location, ...skills, ...v.chips]), former ? rankText(q, [former]) * 0.9 : 0) : 50;
    hits.push({ handle: p.handle, name: v.name, avatarUrl: v.avatarUrl, kind: p.kind, kindLabel: kindLabel(p.kind), headline: v.headline, location: v.location, skills: skills.slice(0, 4), chips: v.chips, verified: v.verified, formerHandle, rank, at: p.createdAt.getTime() });
  }
  const ranked = orderHits(hits.filter((h) => !q || h.rank > 0 || o.skill || o.location || o.industry), o.sort);
  return pageOf(ranked, o.page, o.size);
}
