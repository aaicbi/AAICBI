import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import OrgBadges from "@/components/ecosystem/OrgBadges";
import { featuredOrganizations } from "@/lib/ecosystem/visibility";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training organizations",
  description: "Organizations training people across Africa — programs, trainees and educational videos.",
};

/** /organizations — directory of organizations with a public page. */
export default async function OrganizationsPage() {
  const flags = await getEcosystemFlags();
  if (!flags.orgPages) notFound();

  const orgs = await prisma.trainingOrganization.findMany({
    where: { approvalState: "APPROVED", publicProfile: { is: { publicEnabled: true } } },
    select: { id: true, name: true, logoUrl: true, publicProfile: { select: { slug: true, tagline: true, location: true, verified: true } } },
  });
  // Featured (public criteria set by SUPER_ADMIN) first, then verified, then alphabetical.
  const { featured, all } = await featuredOrganizations().catch(() => ({ featured: [], all: [] }));
  const featuredIds = new Set(featured.map((f) => f.id));
  const badgesById = new Map(all.map((r) => [r.id, r.badges]));
  orgs.sort(
    (a, b) =>
      Number(featuredIds.has(b.id)) - Number(featuredIds.has(a.id)) ||
      Number(!!b.publicProfile?.verified) - Number(!!a.publicProfile?.verified) ||
      a.name.localeCompare(b.name),
  );

  return (
    <>
      <SiteHeader nav={[{ label: "Learn", href: "/learn" }, { label: "Courses", href: "/courses" }]} />
      <EcosystemSubnav active="organizations" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Training organizations</h1>
        <p className="mt-1 text-sm text-gray-600">Organizations training people, and the trainees building real things.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {orgs.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState title="No organizations listed yet" description="Check back soon." />
            </div>
          )}
          {orgs.map((o) => (
            <Link key={o.id} href={`/organizations/${o.publicProfile!.slug}`}>
              <Card interactive className="h-full">
                <div className="flex items-center gap-3">
                  {o.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- an uploaded organization logo.
                    <img src={o.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-mint font-semibold text-brand-teal">{o.name.slice(0, 1)}</span>
                  )}
                  <div>
                    <p className="font-display font-semibold text-brand-ink">{o.name}</p>
                    {featuredIds.has(o.id) && <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Featured</p>}
                    {o.publicProfile?.verified && <VerifiedBadge />}
                  </div>
                </div>
                {o.publicProfile?.tagline && <p className="mt-3 text-sm text-gray-700">{o.publicProfile.tagline}</p>}
                {o.publicProfile?.location && <p className="mt-2 text-xs text-gray-500">{o.publicProfile.location}</p>}
                <div className="mt-2"><OrgBadges badges={badgesById.get(o.id) ?? []} /></div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
