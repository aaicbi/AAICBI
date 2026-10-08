import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import { JobCard, Rail } from "@/components/landing/Cards";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { openJobWhere } from "@/lib/landing/publicWhere";
import { excerpt } from "@/lib/landing/core";
import type { LandingJob } from "@/lib/landing/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Opportunities",
  description: "Open roles from approved employers. Look around freely; you need an account to apply.",
};

const PAGE_SIZE = 12;

/**
 * /jobs — the public job board. Only approved, unexpired postings of
 * approved employers appear (the same rule as the trainee job board), and
 * nothing here lets a visitor apply: that needs an account, and the
 * posting's own page asks for one at the moment it matters.
 */
export default async function PublicJobsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.publicJobs) notFound();

  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(200, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const where = {
    ...openJobWhere(),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { employer: { companyName: { contains: q, mode: "insensitive" as const } } },
            { skills: { some: { skill: { name: { contains: q, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, description: true, closingDate: true, createdAt: true,
        employer: { select: { companyName: true } },
        skills: { select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.jobPosting.count({ where }),
  ]);
  const jobs: LandingJob[] = rows.map((j) => ({
    id: j.id, title: j.title, company: j.employer.companyName, summary: excerpt(j.description, 160),
    skills: j.skills.map((s) => s.skill.name).slice(0, 4), closingDate: j.closingDate.toISOString(),
    href: `/jobs/${j.id}`, at: j.createdAt.toISOString(), isSample: false,
  }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/jobs?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`.replace(/\?$/, "");

  return (
    <>
      <SiteHeader nav={[{ label: "Training", href: "/courses" }, { label: "Verify a Certificate", href: "/certificate" }]} />
      <EcosystemSubnav active="jobs" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Opportunities</h1>
        <p className="mt-1 text-sm text-gray-600">Open roles from approved employers. You can read everything here; you need an account to apply.</p>

        <form action="/jobs" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="jobs-q" className="sr-only">
            Search by role, skill or company
          </label>
          <input id="jobs-q" name="q" defaultValue={q} placeholder="Role, skill or company" maxLength={80} className="min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal" />
          <button type="submit" className="min-h-[44px] shrink-0 rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
            Search
          </button>
        </form>

        <div className="mt-8">
          {jobs.length === 0 ? (
            <EmptyState
              title={q ? "No opportunities match that search" : "No open opportunities right now"}
              description={q ? "Try a different word, or clear the search." : "Employers post roles here as they open. Check back soon."}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-600">
                {total} open {total === 1 ? "opportunity" : "opportunities"}
                {q ? ` matching “${q}”` : ""}
              </p>
              <Rail label="Open opportunities">{jobs.map((j) => <JobCard key={j.id} j={j} />)}</Rail>
            </>
          )}
        </div>

        {pages > 1 && (
          <nav aria-label="Pages" className="mt-8 flex items-center justify-between text-sm font-semibold">
            {page > 1 ? <Link href={link(page - 1)} className="text-brand-teal hover:underline">Previous</Link> : <span />}
            <span className="text-gray-600">Page {page} of {pages}</span>
            {page < pages ? <Link href={link(page + 1)} className="text-brand-teal hover:underline">Next</Link> : <span />}
          </nav>
        )}
      </main>
    </>
  );
}
