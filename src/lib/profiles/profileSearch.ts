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

  const [byHandle, byFormer, trainees, employers, orgs, staff] = await Promise.all([
    prisma.profile.findMany({ where: { handle: contains }, take: CANDIDATES }),
    prisma.profileHandleHistory.findMany({ where: { handle: contains }, take: CANDIDATES }),
    prisma.trainee.findMany({ where: { name: contains }, select: { id: true }, take: CANDIDATES }),
    prisma.employer.findMany({ where: { companyName: contains }, select: { id: true }, take: CANDIDATES }),
    prisma.trainingOrganization.findMany({ where: { name: contains }, select: { id: true }, take: CANDIDATES }),
    prisma.user.findMany({ where: { name: contains, trainingOrgAsStaffUser: null }, select: { id: true }, take: CANDIDATES }),
  ]);

  const byName = await prisma.profile.findMany({
    where: { OR: [{ traineeId: { in: trainees.map((t) => t.id) } }, { employerId: { in: employers.map((e) => e.id) } }, { trainingOrganizationId: { in: orgs.map((o) => o.id) } }, { userId: { in: staff.map((s) => s.id) } }] },
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
