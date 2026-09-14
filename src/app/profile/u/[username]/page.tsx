import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { canViewProfile } from "@/lib/profileVisibility";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import AvatarFallback from "@/components/ui/AvatarFallback";

/**
 * Universal profile system, Phase 4 — the authenticated-viewing rich
 * profile page. Deliberately a server component, same pattern as
 * `/profile/[code]/page.tsx` (M37's anonymous share-link page, left
 * completely untouched) rather than a client component fetching its
 * own API — a read-only page has no reason to round-trip through
 * `/api/profile/u/[username]` itself; both share the same
 * `canViewProfile` check from src/lib/profileVisibility.ts so the two
 * surfaces can't drift into different access rules.
 *
 * "Doesn't exist" and "exists but you can't see it" render the exact
 * same message — the same non-oracle discipline `/profile/[code]`
 * already established.
 */
export default async function AuthenticatedProfilePage({ params }: { params: { username: string } }) {
  const viewer = await getSession();

  const trainee = await prisma.trainee.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      username: true,
      location: true,
      linkedinUrl: true,
      githubUrl: true,
      portfolioUrl: true,
      currentEmploymentStatus: true,
      openToWork: true,
      profileVisibility: true,
      availabilityTypes: { select: { type: true } },
      skills: { select: { proficiency: true, skill: { select: { name: true } } } },
      education: { orderBy: { order: "asc" } },
      workExperiences: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
      badges: { select: { threshold: true, course: { select: { title: true } } } },
      certificates: { where: { revokedAt: null }, select: { code: true, course: { select: { title: true } } } },
    },
  });

  if (trainee) {
    const allowed = await canViewProfile(trainee.profileVisibility, trainee.id, "TRAINEE", viewer);
    if (!allowed) return <NotFound />;
    return <TraineeProfileView trainee={trainee} viewerRole={viewer?.role ?? null} />;
  }

  const staff = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      username: true,
      role: true,
      bio: true,
      jobTitle: true,
      department: true,
      areasOfResponsibility: true,
      profileVisibility: true,
    },
  });

  if (staff) {
    const allowed = await canViewProfile(staff.profileVisibility, staff.id, "STAFF", viewer);
    if (!allowed) return <NotFound />;
    return <StaffProfileView staff={staff} viewerRole={viewer?.role ?? null} />;
  }

  return <NotFound />;
}

function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-gray-600">This profile could not be found.</p>
      </main>
    </>
  );
}

/**
 * A viewer looking at someone ELSE's profile here isn't "in" that
 * person's role section, so a full nav bar doesn't fit — but they
 * still need a way back to their own dashboard, which a bare
 * `<SiteHeader />` didn't provide. Anonymous (PUBLIC-tier) viewers
 * genuinely have no dashboard to link to, so this renders nothing for
 * them rather than a broken/guessed link.
 */
function dashboardHrefForRole(role: string | null): string | null {
  if (role === "TRAINEE") return "/trainee/dashboard";
  if (role === "EMPLOYER") return "/employer/dashboard";
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "INSTRUCTOR") return "/admin/dashboard";
  return null;
}

function BackToDashboard({ viewerRole }: { viewerRole: string | null }) {
  const href = dashboardHrefForRole(viewerRole);
  if (!href) return null;
  return <BackLink href={href}>Back to Dashboard</BackLink>;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
};

function TraineeProfileView({
  trainee,
  viewerRole,
}: {
  viewerRole: string | null;
  trainee: {
    name: string;
    avatarUrl: string | null;
    username: string | null;
    location: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    currentEmploymentStatus: string | null;
    openToWork: boolean;
    availabilityTypes: { type: string }[];
    skills: { proficiency: string; skill: { name: string } }[];
    education: { id: string; institution: string; fieldOfStudy: string | null; credential: string | null }[];
    workExperiences: { id: string; employerName: string; title: string; description: string | null }[];
    projects: { id: string; title: string; description: string | null; url: string | null }[];
    badges: { threshold: number; course: { title: string } }[];
    certificates: { code: string; course: { title: string } }[];
  };
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <BackToDashboard viewerRole={viewerRole} />
        <div className="mt-2 flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-mint">
            {trainee.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={trainee.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <AvatarFallback size="lg" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{trainee.name}</h1>
            <p className="text-sm text-gray-500">
              @{trainee.username}
              {trainee.location && ` · ${trainee.location}`}
              {trainee.openToWork && " · Open to work"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {trainee.linkedinUrl && (
            <a href={trainee.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
              LinkedIn
            </a>
          )}
          {trainee.githubUrl && (
            <a href={trainee.githubUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
              GitHub
            </a>
          )}
          {trainee.portfolioUrl && (
            <a href={trainee.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
              Portfolio
            </a>
          )}
        </div>

        {trainee.availabilityTypes.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Open to: {trainee.availabilityTypes.map((a) => AVAILABILITY_LABELS[a.type] ?? a.type).join(", ")}
          </p>
        )}

        {trainee.skills.length > 0 && (
          <Card className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Skills</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {trainee.skills.map((s) => (
                <li key={s.skill.name} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                  {s.skill.name}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trainee.education.length > 0 && (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Education</p>
            <ul className="mt-2 space-y-1 text-sm text-brand-ink">
              {trainee.education.map((e) => (
                <li key={e.id}>
                  {e.institution}
                  {e.fieldOfStudy && ` — ${e.fieldOfStudy}`}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trainee.workExperiences.length > 0 && (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Experience</p>
            <ul className="mt-2 space-y-2 text-sm text-brand-ink">
              {trainee.workExperiences.map((e) => (
                <li key={e.id}>
                  <p className="font-semibold">
                    {e.title} · {e.employerName}
                  </p>
                  {e.description && <p className="text-xs text-gray-600">{e.description}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trainee.projects.length > 0 && (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Projects</p>
            <ul className="mt-2 space-y-1 text-sm">
              {trainee.projects.map((p) => (
                <li key={p.id}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-brand-teal hover:underline">
                      {p.title}
                    </a>
                  ) : (
                    <span className="text-brand-ink">{p.title}</span>
                  )}
                  {p.description && <span className="text-xs text-gray-600"> — {p.description}</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trainee.certificates.length > 0 && (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Certificates</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {trainee.certificates.map((c) => (
                <li key={c.code} className="rounded-full bg-brand-mint px-2.5 py-1 text-xs font-medium text-brand-teal">
                  {c.course.title}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {trainee.badges.length > 0 && (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Achievements</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {trainee.badges.map((b, i) => (
                <li key={i} className="rounded-full bg-brand-goldLight px-2.5 py-1 text-xs font-medium text-brand-goldText">
                  {b.threshold}% · {b.course.title}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}

function StaffProfileView({
  staff,
  viewerRole,
}: {
  viewerRole: string | null;
  staff: {
    name: string;
    avatarUrl: string | null;
    username: string | null;
    role: string;
    bio: string | null;
    jobTitle: string | null;
    department: string | null;
    areasOfResponsibility: string | null;
  };
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <BackToDashboard viewerRole={viewerRole} />
        <div className="mt-2 flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brand-mint">
            {staff.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staff.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <AvatarFallback size="lg" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">{staff.name}</h1>
            <p className="text-sm text-gray-500">
              {staff.jobTitle ?? "AAICBI Staff"}
              {staff.department && ` · ${staff.department}`}
            </p>
          </div>
        </div>
        {staff.bio && <p className="mt-4 text-sm text-gray-700">{staff.bio}</p>}
        {staff.areasOfResponsibility && (
          <Card className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Areas of Responsibility</p>
            <p className="mt-2 text-sm text-brand-ink">{staff.areasOfResponsibility}</p>
          </Card>
        )}
      </main>
    </>
  );
}
