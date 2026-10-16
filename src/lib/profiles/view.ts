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
  following: number | null;
  profileId: string;
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

async function loadProfileViewCore(profile: Profile, viewer: SessionPayload | null): Promise<Omit<ProfileView, "following" | "profileId"> | null> {
  const base = { kind: profile.kind, handle: profile.handle, avatarUrl: null as string | null, coverUrl: null as string | null, headline: null as string | null, about: null as string | null, location: null as string | null, verified: false, chips: [] as string[], followers: null as number | null, moreHref: null as string | null, moreLabel: null as string | null, links: [] as Array<{ label: string; href: string }>, note: null as string | null, sections: [] as ProfileSection[] };

  if (profile.kind === "PERSON" && profile.traineeId) {
    const t = await prisma.trainee.findUnique({
      where: { id: profile.traineeId },
      select: {
        id: true, name: true, emailVerified: true, avatarUrl: true, location: true, linkedinUrl: true, githubUrl: true, portfolioUrl: true, openToWork: true, profileVisibility: true,
        availabilityTypes: { select: { type: true } },
        skills: { select: { skill: { select: { name: true } } } },
        education: { orderBy: { order: "asc" }, select: { id: true, institution: true, fieldOfStudy: true } },
        workExperiences: { orderBy: { order: "asc" }, select: { id: true, employerName: true, title: true, description: true } },
        projects: { orderBy: { order: "asc" }, select: { id: true, title: true, description: true, url: true } },
        badges: { select: { threshold: true, course: { select: { title: true } } } },
        certificates: { where: { revokedAt: null }, select: { code: true, course: { select: { title: true } } } },
      },
    });
    if (!t) return null;
    if (!(await canViewProfile(t.profileVisibility, t.id, "TRAINEE", viewer))) {
      // Anyone who has joined and confirmed their email can be found by name (they already appear by name on their posts and
      // comments). What they have chosen to keep private (place, skills, history, links) stays private.
      if (!t.emailVerified) return null;
      return { ...base, name: t.name, avatarUrl: t.avatarUrl, note: "This member keeps the rest of their profile private." };
    }
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
    if (!o || o.approvalState !== "APPROVED") return null;
    // An approved organization can be found by name even before it switches its public page on.
    if (!pp?.publicEnabled) return { ...base, name: o.name, avatarUrl: o.logoUrl, note: "This organization has not published its public page yet." };
    return { ...base, name: o.name, avatarUrl: o.logoUrl, coverUrl: pp.coverUrl, headline: pp.tagline, about: pp.description, location: pp.location, verified: pp.verified, followers: o._count.followers, moreHref: `/organizations/${pp.slug}`, moreLabel: "Courses and events" };
  }

  if (profile.kind === "EMPLOYER" && profile.employerId) {
    const e = await prisma.employer.findUnique({ where: { id: profile.employerId }, select: { id: true, companyName: true, logoUrl: true, approvalState: true, profileVisibility: true } });
    if (!e || e.approvalState !== "APPROVED") return null;
    const owner = viewer?.role === "EMPLOYER" && viewer.userId === e.id;
    const allowed = owner || isStaff(viewer) || e.profileVisibility === "PUBLIC" || (e.profileVisibility === "AUTHENTICATED" && !!viewer);
    // An approved employer can be found by company name; there is nothing more on its page to hide.
    if (!allowed) return { ...base, name: e.companyName, avatarUrl: e.logoUrl, note: "This employer keeps the rest of its profile private." };
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

/**
 * What a visitor may see on a profile, or null (the page cannot be used to
 * learn which accounts exist). Follower and following counts are public for
 * every profile; who the followers are is not (see followersOf).
 */
export async function loadProfileView(profile: Profile, viewer: SessionPayload | null): Promise<ProfileView | null> {
  const v = await loadProfileViewCore(profile, viewer);
  if (!v) return null;
  const [followers, following] = await Promise.all([prisma.follow.count({ where: { followedProfileId: profile.id } }), prisma.follow.count({ where: { followerProfileId: profile.id } })]);
  return { ...v, followers, following, profileId: profile.id };
}

/**
 * Which of these profiles loadProfileView would return a page for, worked out for the whole list in a handful of queries.
 * It follows exactly the same rules (a member found by name once their email is confirmed, an approved organization or employer,
 * a startup once approved or to staff and its own team, an investor only to themselves and staff), but never builds the pages.
 * Use it where a list only needs to know whether each profile is visible; one profile at a time costs about ten queries each.
 */
export async function visibleProfileIds(profiles: Profile[], viewer: SessionPayload | null): Promise<Set<string>> {
  const pick = (k: keyof Profile) => [...new Set(profiles.map((p) => p[k] as string | null).filter((x): x is string => !!x))];
  const traineeIds = pick("traineeId");
  const userIds = pick("userId");
  const orgIds = pick("trainingOrganizationId");
  const employerIds = pick("employerId");
  const startupIds = pick("startupId");
  const investorIds = pick("investorId");
  const [trainees, users, orgs, employers, startups, investors, teams] = await Promise.all([
    traineeIds.length ? prisma.trainee.findMany({ where: { id: { in: traineeIds } }, select: { id: true, emailVerified: true, profileVisibility: true } }) : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, active: true, profileVisibility: true } }) : [],
    orgIds.length ? prisma.trainingOrganization.findMany({ where: { id: { in: orgIds }, approvalState: "APPROVED" }, select: { id: true } }) : [],
    employerIds.length ? prisma.employer.findMany({ where: { id: { in: employerIds }, approvalState: "APPROVED" }, select: { id: true } }) : [],
    startupIds.length ? prisma.startup.findMany({ where: { id: { in: startupIds } }, select: { id: true, status: true } }) : [],
    investorIds.length ? prisma.investor.findMany({ where: { id: { in: investorIds } }, select: { id: true } }) : [],
    startupIds.length && viewer?.role === "TRAINEE" ? prisma.startupMember.findMany({ where: { startupId: { in: startupIds }, traineeId: viewer.userId, status: "ACTIVE" }, select: { startupId: true } }) : [],
  ]);
  const t = new Map(trainees.map((x) => [x.id, x]));
  const u = new Map(users.map((x) => [x.id, x]));
  const okOrg = new Set(orgs.map((x) => x.id));
  const okEmployer = new Set(employers.map((x) => x.id));
  const st = new Map(startups.map((x) => [x.id, x]));
  const okInvestor = new Set(investors.map((x) => x.id));
  const mine = new Set(teams.map((x) => x.startupId));
  const staff = isStaff(viewer);
  const out = new Set<string>();
  for (const p of profiles) {
    let ok = false;
    if (p.kind === "PERSON" && p.traineeId) {
      const x = t.get(p.traineeId);
      ok = !!x && (x.emailVerified || (await canViewProfile(x.profileVisibility, x.id, "TRAINEE", viewer)));
    } else if (p.kind === "STAFF" && p.userId) {
      const x = u.get(p.userId);
      ok = !!x && x.active && (await canViewProfile(x.profileVisibility, x.id, "STAFF", viewer));
    } else if (p.kind === "TRAINING_ORG" && p.trainingOrganizationId) ok = okOrg.has(p.trainingOrganizationId);
    else if (p.kind === "EMPLOYER" && p.employerId) ok = okEmployer.has(p.employerId);
    else if (p.kind === "STARTUP" && p.startupId) {
      const x = st.get(p.startupId);
      ok = !!x && (x.status === "APPROVED" || staff || mine.has(x.id));
    } else if (p.kind === "INVESTOR" && p.investorId) ok = okInvestor.has(p.investorId) && ((viewer?.role === "INVESTOR" && viewer.userId === p.investorId) || staff);
    if (ok) out.add(p.id);
  }
  return out;
}
