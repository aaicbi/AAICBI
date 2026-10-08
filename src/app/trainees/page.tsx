import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import { Rail, TraineeCard } from "@/components/landing/Cards";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { publicTraineeWhere } from "@/lib/landing/publicWhere";
import type { LandingTrainee } from "@/lib/landing/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainees",
  description: "Trainees who chose a public profile: their skills, projects and certificates.",
};

const PAGE_SIZE = 12;

/**
 * /trainees — the public trainee directory. A trainee appears here only if
 * they set their profile visibility to Public, have a username and a
 * verified email. Cards show name, photo, place and skills and link to the
 * trainee's own profile page; contact details are never selected.
 */
export default async function PublicTraineesPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.publicTrainees) notFound();

  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(200, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const where = {
    ...publicTraineeWhere(),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { location: { contains: q, mode: "insensitive" as const } },
            { skills: { some: { skill: { name: { contains: q, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.trainee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, avatarUrl: true, username: true, location: true, openToWork: true,
        skills: { take: 4, select: { skill: { select: { name: true } } } },
      },
    }),
    prisma.trainee.count({ where }),
  ]);
  const trainees: LandingTrainee[] = rows.map((t, i) => ({
    id: t.id, name: t.name, username: t.username ?? "", avatarUrl: t.avatarUrl, location: t.location, openToWork: t.openToWork,
    skills: t.skills.map((s) => s.skill.name), href: `/profile/u/${t.username}`, avatarSeed: i + 1 + (page - 1) * PAGE_SIZE, isSample: false,
  }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/trainees?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`.replace(/\?$/, "");

  return (
    <>
      <SiteHeader nav={[{ label: "Training", href: "/courses" }, { label: "Verify a Certificate", href: "/certificate" }]} />
      <EcosystemSubnav active="trainees" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Trainees</h1>
        <p className="mt-1 text-sm text-gray-600">People who chose to make their profile public. Each profile shows what that person decided to share.</p>

        <form action="/trainees" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="trainees-q" className="sr-only">
            Search by name, skill or place
          </label>
          <input id="trainees-q" name="q" defaultValue={q} placeholder="Name, skill or place" maxLength={80} className="min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal" />
          <button type="submit" className="min-h-[44px] shrink-0 rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
            Search
          </button>
        </form>

        <div className="mt-8">
          {trainees.length === 0 ? (
            <EmptyState
              title={q ? "No trainees match that search" : "No public profiles yet"}
              description={q ? "Try a different word, or clear the search." : "Trainees appear here when they choose a public profile in their settings."}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-600">
                {total} public {total === 1 ? "profile" : "profiles"}
                {q ? ` matching “${q}”` : ""}
              </p>
              <Rail label="Public trainee profiles">{trainees.map((t) => <TraineeCard key={t.id} t={t} />)}</Rail>
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
