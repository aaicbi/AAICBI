import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";
import EducationVideoCard from "@/components/ecosystem/EducationVideoCard";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { listPublicVideos } from "@/lib/ecosystem/queries";

export const dynamic = "force-dynamic";

const TABS = ["home", "programs", "education", "about"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { home: "Home", programs: "Programs", education: "Education", about: "About" };

/** Only public, non-private fields are ever selected here — no email, phone, billing or account data. */
async function loadOrg(slug: string) {
  return prisma.trainingOrganization.findFirst({
    where: { approvalState: "APPROVED", publicProfile: { is: { slug, publicEnabled: true } } },
    select: {
      id: true, name: true, logoUrl: true, website: true, staffUserId: true,
      publicProfile: { select: { slug: true, tagline: true, description: true, location: true, coverUrl: true, verified: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const flags = await getEcosystemFlags();
  if (!flags.orgPages) return {};
  const org = await loadOrg(params.slug);
  if (!org?.publicProfile) return {};
  const description = org.publicProfile.tagline ?? org.publicProfile.description?.slice(0, 160) ?? `${org.name} on AAICBI`;
  return { title: org.name, description, alternates: { canonical: `/organizations/${org.publicProfile.slug}` }, openGraph: { title: org.name, description } };
}

export default async function OrganizationPage({ params, searchParams }: { params: { slug: string }; searchParams: { tab?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.orgPages) notFound();
  const org = await loadOrg(params.slug);
  if (!org?.publicProfile) notFound();
  const profile = org.publicProfile;
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "home";

  const [courses, videos, traineeCount] = await Promise.all([
    org.staffUserId
      ? prisma.course.findMany({
          where: { createdById: org.staffUserId, status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 24,
          select: { id: true, title: true, description: true, category: true, durationDisplay: true, trainingFormat: true },
        })
      : Promise.resolve([]),
    flags.education ? listPublicVideos({ trainingOrganizationId: org.id }, tab === "education" ? 36 : 3) : Promise.resolve([]),
    org.staffUserId ? prisma.trainee.count({ where: { courseEnrollments: { some: { course: { createdById: org.staffUserId } } } } }) : Promise.resolve(0),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: org.name,
    description: profile.description ?? profile.tagline ?? undefined,
    url: org.website ?? undefined,
    logo: org.logoUrl ?? undefined,
    address: profile.location ?? undefined,
  };

  return (
    <>
      <SiteHeader nav={[{ label: "Organizations", href: "/organizations" }, { label: "Learn", href: "/learn" }]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-brand-gray bg-brand-surface">
          <div className="h-32 bg-brand-mint sm:h-44">
            {profile.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- an organization-supplied cover image URL.
              <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- an uploaded organization logo.
                <img src={org.logoUrl} alt="" className="-mt-12 h-20 w-20 rounded-xl border-4 border-brand-surface bg-brand-surface object-cover" />
              ) : (
                <span className="-mt-12 flex h-20 w-20 items-center justify-center rounded-xl border-4 border-brand-surface bg-brand-mint text-2xl font-semibold text-brand-teal">
                  {org.name.slice(0, 1)}
                </span>
              )}
              <div>
                <h1 className="font-display text-xl font-semibold text-brand-ink">{org.name}</h1>
                {profile.verified && <VerifiedBadge />}
                {profile.location && <p className="text-sm text-gray-600">{profile.location}</p>}
              </div>
            </div>
            <div className="flex gap-6 text-center text-sm">
              <div><p className="font-semibold text-brand-ink">{courses.length}</p><p className="text-gray-600">Programs</p></div>
              <div><p className="font-semibold text-brand-ink">{traineeCount}</p><p className="text-gray-600">Trainees</p></div>
              {flags.education && <div><p className="font-semibold text-brand-ink">{videos.length}</p><p className="text-gray-600">Videos</p></div>}
            </div>
          </div>
          {profile.tagline && <p className="px-5 pb-4 text-sm text-gray-700">{profile.tagline}</p>}
          <nav aria-label="Organization sections" className="flex gap-1 overflow-x-auto border-t border-brand-gray px-3">
            {TABS.filter((t) => t !== "education" || flags.education).map((t) => (
              <Link
                key={t}
                href={t === "home" ? `/organizations/${profile.slug}` : `/organizations/${profile.slug}?tab=${t}`}
                aria-current={tab === t ? "page" : undefined}
                className={`whitespace-nowrap px-4 py-3 text-sm font-semibold ${tab === t ? "border-b-2 border-brand-teal text-brand-teal" : "text-gray-600 hover:text-brand-ink"}`}
              >
                {TAB_LABEL[t]}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {tab === "home" && (
            <div className="space-y-8">
              {profile.description && <p className="whitespace-pre-line text-sm text-gray-700">{profile.description}</p>}
              {flags.education && videos.length > 0 && (
                <section aria-labelledby="latest-videos">
                  <div className="flex items-center justify-between">
                    <h2 id="latest-videos" className="font-display text-lg font-semibold text-brand-ink">Latest from our trainees</h2>
                    <Link href={`/organizations/${profile.slug}?tab=education`} className="text-sm font-semibold text-brand-teal hover:underline">See all</Link>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {videos.map((v) => <EducationVideoCard key={v.id} post={v} hideOrganizationLink />)}
                  </div>
                </section>
              )}
              <ProgramList courses={courses.slice(0, 3)} orgName={org.name} />
            </div>
          )}
          {tab === "programs" && <ProgramList courses={courses} orgName={org.name} />}
          {tab === "education" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3"><EmptyState title="No videos yet" description="Trainee videos will appear here." /></div>
              ) : (
                videos.map((v) => <EducationVideoCard key={v.id} post={v} hideOrganizationLink />)
              )}
            </div>
          )}
          {tab === "about" && (
            <Card>
              <p className="whitespace-pre-line text-sm text-gray-700">{profile.description ?? "This organization has not added a description yet."}</p>
              {org.website && (
                <p className="mt-3 text-sm">
                  <a href={org.website} rel="noopener nofollow" target="_blank" className="font-semibold text-brand-teal hover:underline">Visit website</a>
                </p>
              )}
            </Card>
          )}
        </div>
      </main>
    </>
  );
}

function ProgramList({
  courses,
  orgName,
}: {
  courses: Array<{ id: string; title: string; description: string | null; category: string | null; durationDisplay: string | null }>;
  orgName: string;
}) {
  return (
    <section aria-labelledby="programs-heading">
      <h2 id="programs-heading" className="font-display text-lg font-semibold text-brand-ink">Programs</h2>
      {courses.length === 0 ? (
        <div className="mt-3"><EmptyState title="No programs open yet" description={`${orgName} has not published a program.`} /></div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Card key={c.id}>
              <p className="font-display font-semibold text-brand-ink">{c.title}</p>
              <p className="mt-1 text-xs text-gray-600">{[c.category, c.durationDisplay].filter(Boolean).join(" • ")}</p>
              {c.description && <p className="mt-2 line-clamp-2 text-sm text-gray-700">{c.description}</p>}
              <div className="mt-3"><Button href={`/courses/${c.id}`} size="sm">View program</Button></div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
