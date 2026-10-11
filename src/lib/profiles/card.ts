import type { Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { kindLabel } from "@/lib/profiles/view";

/** The little identity shown beside a post: name, picture, handle and kind. */
export interface ProfileCard {
  profileId: string;
  handle: string;
  kind: Profile["kind"];
  kindLabel: string;
  name: string;
  avatarUrl: string | null;
  square: boolean;
}

/** Cards for many profiles at once (one query per kind), keyed by profile id. */
export async function cardsFor(profiles: Profile[]): Promise<Map<string, ProfileCard>> {
  const ids = (key: keyof Profile) => profiles.map((p) => p[key] as string | null).filter((x): x is string => !!x);
  const [trainees, employers, orgs, staff, startups, investors] = await Promise.all([
    prisma.trainee.findMany({ where: { id: { in: ids("traineeId") } }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.employer.findMany({ where: { id: { in: ids("employerId") } }, select: { id: true, companyName: true, logoUrl: true } }),
    prisma.trainingOrganization.findMany({ where: { id: { in: ids("trainingOrganizationId") } }, select: { id: true, name: true, logoUrl: true } }),
    prisma.user.findMany({ where: { id: { in: ids("userId") } }, select: { id: true, name: true, avatarUrl: true } }),
    prisma.startup.findMany({ where: { id: { in: ids("startupId") } }, select: { id: true, name: true, logoUrl: true } }),
    prisma.investor.findMany({ where: { id: { in: ids("investorId") } }, select: { id: true, name: true } }),
  ]);
  const t = new Map(trainees.map((x) => [x.id, { name: x.name, avatarUrl: x.avatarUrl }]));
  const e = new Map(employers.map((x) => [x.id, { name: x.companyName, avatarUrl: x.logoUrl }]));
  const o = new Map(orgs.map((x) => [x.id, { name: x.name, avatarUrl: x.logoUrl }]));
  const s = new Map(staff.map((x) => [x.id, { name: x.name, avatarUrl: x.avatarUrl }]));
  const st = new Map(startups.map((x) => [x.id, { name: x.name, avatarUrl: x.logoUrl }]));
  const i = new Map(investors.map((x) => [x.id, { name: x.name, avatarUrl: null as string | null }]));
  const out = new Map<string, ProfileCard>();
  for (const p of profiles) {
    const src = (p.traineeId && t.get(p.traineeId)) || (p.employerId && e.get(p.employerId)) || (p.trainingOrganizationId && o.get(p.trainingOrganizationId)) || (p.userId && s.get(p.userId)) || (p.startupId && st.get(p.startupId)) || (p.investorId && i.get(p.investorId)) || null;
    out.set(p.id, { profileId: p.id, handle: p.handle, kind: p.kind, kindLabel: kindLabel(p.kind), name: src ? src.name : p.handle, avatarUrl: src?.avatarUrl ?? null, square: p.kind !== "PERSON" && p.kind !== "STAFF" });
  }
  return out;
}
