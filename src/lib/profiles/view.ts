import type { Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { canViewProfile } from "@/lib/profileVisibility";

/**
 * What a visitor may see on a profile page. Visibility always comes from the
 * source account (never copied), and an unknown, hidden or private profile
 * returns null so the page cannot be used to learn which accounts exist.
 */
export interface ProfileView {
  kind: Profile["kind"];
  handle: string;
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  verified: boolean;
  chips: string[];
  followers: number | null;
  /** The existing detailed page for this account, when there is one. */
  moreHref: string | null;
  moreLabel: string | null;
}

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];
const isStaff = (v: SessionPayload | null) => !!v && STAFF_ROLES.includes(v.role);

export function kindLabel(kind: Profile["kind"]): string {
  return { PERSON: "Member", TRAINING_ORG: "Training organization", EMPLOYER: "Employer", INVESTOR: "Investor", STAFF: "AAICBI team", STARTUP: "Startup" }[kind];
}

export async function loadProfileView(profile: Profile, viewer: SessionPayload | null): Promise<ProfileView | null> {
  const base = { kind: profile.kind, handle: profile.handle, avatarUrl: null as string | null, coverUrl: null as string | null, headline: null as string | null, about: null as string | null, location: null as string | null, verified: false, chips: [] as string[], followers: null as number | null, moreHref: null as string | null, moreLabel: null as string | null };

  if (profile.kind === "PERSON" && profile.traineeId) {
    const t = await prisma.trainee.findUnique({
      where: { id: profile.traineeId },
      select: { id: true, name: true, avatarUrl: true, username: true, location: true, profileVisibility: true, skills: { take: 8, select: { skill: { select: { name: true } } } } },
    });
    if (!t || !(await canViewProfile(t.profileVisibility, t.id, "TRAINEE", viewer))) return null;
    return { ...base, name: t.name, avatarUrl: t.avatarUrl, location: t.location, chips: t.skills.map((s) => s.skill.name), moreHref: t.username ? `/profile/u/${t.username}` : null, moreLabel: "See full profile" };
  }

  if (profile.kind === "STAFF" && profile.userId) {
    const u = await prisma.user.findUnique({ where: { id: profile.userId }, select: { id: true, name: true, avatarUrl: true, username: true, bio: true, jobTitle: true, active: true, profileVisibility: true } });
    if (!u || !u.active || !(await canViewProfile(u.profileVisibility, u.id, "STAFF", viewer))) return null;
    return { ...base, name: u.name, avatarUrl: u.avatarUrl, headline: u.jobTitle, about: u.bio, moreHref: u.username ? `/profile/u/${u.username}` : null, moreLabel: "See full profile" };
  }

  if (profile.kind === "TRAINING_ORG" && profile.trainingOrganizationId) {
    const o = await prisma.trainingOrganization.findUnique({
      where: { id: profile.trainingOrganizationId },
      select: { id: true, name: true, logoUrl: true, approvalState: true, publicProfile: { select: { slug: true, tagline: true, description: true, location: true, coverUrl: true, verified: true, publicEnabled: true } }, _count: { select: { followers: true } } },
    });
    const pp = o?.publicProfile;
    if (!o || o.approvalState !== "APPROVED" || !pp?.publicEnabled) return null;
    return { ...base, name: o.name, avatarUrl: o.logoUrl, coverUrl: pp.coverUrl, headline: pp.tagline, about: pp.description, location: pp.location, verified: pp.verified, followers: o._count.followers, moreHref: `/organizations/${pp.slug}`, moreLabel: "Courses and events" };
  }

  if (profile.kind === "EMPLOYER" && profile.employerId) {
    const e = await prisma.employer.findUnique({ where: { id: profile.employerId }, select: { id: true, companyName: true, logoUrl: true, approvalState: true, profileVisibility: true } });
    if (!e || e.approvalState !== "APPROVED") return null;
    const owner = viewer?.role === "EMPLOYER" && viewer.userId === e.id;
    const allowed = owner || isStaff(viewer) || e.profileVisibility === "PUBLIC" || (e.profileVisibility === "AUTHENTICATED" && !!viewer);
    if (!allowed) return null;
    return { ...base, name: e.companyName, avatarUrl: e.logoUrl };
  }

  // Investors have no public profile setting yet, so only the owner and staff see one.
  if (profile.kind === "INVESTOR" && profile.investorId) {
    const i = await prisma.investor.findUnique({ where: { id: profile.investorId }, select: { id: true, name: true, approvalState: true } });
    const allowed = !!i && ((viewer?.role === "INVESTOR" && viewer.userId === i.id) || isStaff(viewer));
    if (!i || !allowed) return null;
    return { ...base, name: i.name };
  }

  return null;
}
