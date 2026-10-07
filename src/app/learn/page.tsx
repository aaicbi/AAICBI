import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import EducationVideoCard from "@/components/ecosystem/EducationVideoCard";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import { PUBLIC_POST_WHERE, listPublicVideos, listTrendingVideos } from "@/lib/ecosystem/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Learn from trainees",
  description: "Educational videos presented by trainees of AAICBI training organizations.",
};

/** /learn — the public education feed. Dark (404) until SUPER_ADMIN switches education on. */
export default async function LearnPage({ searchParams }: { searchParams: { category?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.education || !flags.orgPages) notFound();

  const category = searchParams.category?.trim() || undefined;
  const [videos, trending, categoryRows] = await Promise.all([
    listPublicVideos(category ? { category } : {}),
    category ? Promise.resolve([]) : listTrendingVideos(3),
    prisma.educationPost.findMany({ where: { ...PUBLIC_POST_WHERE, category: { not: null } }, distinct: ["category"], select: { category: true }, take: 20 }),
  ]);
  const categories = categoryRows.map((c) => c.category!).sort();

  return (
    <>
      <SiteHeader nav={[{ label: "Organizations", href: "/organizations" }, { label: "Courses", href: "/courses" }]} />
      <EcosystemSubnav active="learn" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Learn from the people building real projects</h1>
        <p className="mt-1 text-sm text-gray-600">Educational videos presented by trainees and published by their training organizations.</p>

        {categories.length > 0 && (
          <nav aria-label="Categories" className="mt-5 flex flex-wrap gap-2">
            <Link href="/learn" className={`rounded-full border px-3 py-1 text-sm ${!category ? "border-brand-teal bg-brand-mint text-brand-tealDeep" : "border-brand-gray text-gray-700"}`}>
              All
            </Link>
            {categories.map((c) => (
              <Link key={c} href={`/learn?category=${encodeURIComponent(c)}`} className={`rounded-full border px-3 py-1 text-sm ${category === c ? "border-brand-teal bg-brand-mint text-brand-tealDeep" : "border-brand-gray text-gray-700"}`}>
                {c}
              </Link>
            ))}
          </nav>
        )}

        {trending.length > 0 && (
          <section aria-labelledby="trending" className="mt-8">
            <h2 id="trending" className="font-display text-lg font-semibold text-brand-ink">Trending education</h2>
            <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((v) => <EducationVideoCard key={v.id} post={v} />)}
            </div>
          </section>
        )}

        <h2 className="mt-10 font-display text-lg font-semibold text-brand-ink">{category ? category : "Latest"}</h2>
        <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState title="No videos here yet" description="Check back soon." />
            </div>
          ) : (
            videos.map((v) => <EducationVideoCard key={v.id} post={v} />)
          )}
        </div>
      </main>
    </>
  );
}
