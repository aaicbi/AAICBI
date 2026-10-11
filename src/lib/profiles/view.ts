import type { Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { canViewProfile } from "@/lib/profileVisibility";
import { startupProfileData } from "@/lib/startups/startups";
import { SEEKING_LABEL, STAGE_LABEL, type Seeking } from "@/lib/startups/startupCore";

/**
 * What a visitor may see on a profile page. Visibility always comes from the
 * source account (never copied), and an unknown, hidden or private profile
 * returns null so the page cannot be used to learn which accounts exist.
 */
export interface ProfileSectionItem { primary: string; secondary?: string; href?: string; /** A link inside this site (opens in the same tab). */ internal?: boolean }
export interface ProfileSection { title: string; style: "chips" | "gold" | "list"; items: ProfileSectionItem[] }

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
  /** Outside links the person chose to share (LinkedIn, GitHub, portfolio). */
  links: Array<{ label: string; href: string }>;
  /** A short status line such as "Open to work: Internship, Freelance". */
  note: string | null;
  sections: ProfileSection[];
}

const AVAILABILITY_LABELS: Record<string, string> = { INTERNSHIP: "Internship", FREELANCE: "Freelance", FULL_TIME: "Full-time", PART_TIME: "Part-time" };
const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];
const isStaff = (v: SessionPayload | null) => !!v && STAFF_ROLES.includes(v.role);

export function kindLabel(kind: Profile["kind"]): string {
  return { PERSON: "Member", TRAINING_ORG: "Training organization", EMPLOYER: "Employer", INVESTOR: "Investor", STAFF: "AAICBI team", STARTUP: "Startup" }[kind];
}

export async function loadProfileView(profile: Profile, viewer: SessionPayload | null): Promise<ProfileView | null> {
  const base = { kind: profile.kind, handle: profile.handle, avatarUrl: null as string | null, coverUrl: null as string | null, headline: null as string | null, about: null as string | null, location: null as string | null, verified: false, chips: [] as string[], followers: null as number | null, moreHref: null as string | null, moreLabel: null as string | null, links: [] as Array<{ label: string; href: string }>, note: null as string | null, sections: [] as ProfileSection[] };

  if (profile.kind === "PERSON" && profile.traineeId) {
    const t = await prisma.trainee.findUnique({
      where: { id: profile.traineeId },
      select: {
        id: true, name: true, avatarUrl: true, location: true, linkedinUrl: true, githubUrl: true, portfolioUrl: true, openToWork: true, profileVisibility: true,
        availabilityTypes: { select: { type: true } },
        skills: { select: { skill: { select: { name: true } } } },
        education: { orderBy: { order: "asc" }, select: { id: true, institution: true, fieldOfStudy: true } },
        workExperiences: { orderBy: { order: "asc" }, select: { id: true, employerName: true, title: true, description: true } },
        projects: { orderBy: { order: "asc" }, select: { id: true, title: true, description: true, url: true } },
        badges: { select: { threshold: true, course: { select: { title: true } } } },
        certificates: { where: { revokedAt: null }, select: { code: true, course: { select: { title: true } } } },
      },
    });
    if (!t || !(await canViewProfile(t.profileVisibility, t.id, "TRAINEE", viewer))) return null;
    const open = t.availabilityTypes.map((a) => AVAILABILITY_LABELS[a.type] ?? a.type);
    const all: ProfileSection[] = [
      { title: "Skills", style: "chips", items: t.skills.map((x) => ({ primary: x.skill.name })) },
      { title: "Education", style: "list", items: t.education.map((e) => ({ primary: e.institution, secondary: e.fieldOfStudy ?? undefined })) },
      { title: "Experience", style: "list", items: t.workExperiences.map((e) => ({ primary: `${e.title} · ${e.employerName}`, secondary: e.description ?? undefined })) },
      { title: "Projects", style: "list", items: t.projects.map((x) => ({ primary: x.title, secondary: x.description ?? undefined, href: x.url ?? undefined })) },
      { title: "Certificates", style: "chips", items: t.certificates.map((c) => ({ primary: c.course.title })) },
      { title: "Achievements", style: "gold", items: t.badges.map((b) => ({ primary: `${b.threshold}% · ${b.course.title}` })) },
    ];
    const sections = all.filter((x) => x.items.length > 0);
    const links = [t.linkedinUrl && { label: "LinkedIn", href: t.linkedinUrl }, t.githubUrl && { label: "GitHub", href: t.githubUrl }, t.portfolioUrl && { label: "Portfolio", href: t.portfolioUrl }].filter((x): x is { label: string; href: string } => !!x);
    const note = t.openToWork ? (open.length ? `Open to work: ${open.join(", ")}` : "Open to work") : open.length ? `Open to: ${open.join(", ")}` : null;
    return { ...base, name: t.name, avatarUrl: t.avatarUrl, location: t.location, links, note, sections };
  }

  if (profile.kind === "STAFF" && profile.userId) {
    const u = await prisma.user.findUnique({ where: { id: profile.userId }, select: { id: true, name: true, avatarUrl: true, bio: true, jobTitle: true, department: true, areasOfResponsibility: true, active: true, profileVisibility: true } });
    if (!u || !u.active || !(await canViewProfile(u.profileVisibility, u.id, "STAFF", viewer))) return null;
    const sections: ProfileSection[] = u.areasOfResponsibility ? [{ title: "Areas of responsibility", style: "list", items: [{ primary: u.areasOfResponsibility }] }] : [];
    return { ...base, name: u.name, avatarUrl: u.avatarUrl, headline: [u.jobTitle ?? "AAICBI team", u.department].filter(Boolean).join(" · "), about: u.bio, sections };
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

  if (profile.kind === "STARTUP" && profile.startupId) {
    const d = await startupProfileData(profile.startupId, viewer);
    if (!d) return null;
    const x = d.startup;
    const all: ProfileSection[] = [
      { title: "The problem", style: "list", items: x.problem ? [{ primary: x.problem }] : [] },
      { title: "What we built", style: "list", items: x.solution ? [{ primary: x.solution }] : [] },
      { title: "Looking for", style: "chips", items: x.seeking.map((k) => ({ primary: SEEKING_LABEL[k as Seeking] ?? k })) },
      { title: "Traction", style: "list", items: x.traction ? [{ primary: x.traction }] : [] },
      { title: "Funding and support", style: "list", items: x.fundingNeed ? [{ primary: x.fundingNeed }] : [] },
      { title: "Team", style: "list", items: d.team.map((m) => ({ primary: m.name, secondary: [m.role === "FOUNDER" ? "Founder" : null, m.title].filter(Boolean).join(" · ") || undefined, href: m.handle ? `/@${m.handle}` : undefined, internal: true })) },
    ];
    const note = x.status === "APPROVED" ? null : x.status === "SUSPENDED" ? "This startup is suspended and hidden from the public." : "Only the team and reviewers can see this page until it is approved.";
    return { ...base, name: x.name, avatarUrl: x.logoUrl, headline: x.tagline, about: x.description, location: x.location, verified: x.verified, chips: [x.industry, STAGE_LABEL[x.stage]].filter((c): c is string => !!c), links: x.website ? [{ label: "Website", href: x.website }] : [], note, sections: all.filter((sec) => sec.items.length > 0) };
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
