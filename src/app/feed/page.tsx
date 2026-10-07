import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import FeedCard from "@/components/ecosystem/FeedCards";
import { getSession } from "@/lib/auth/session";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { buildFeed, resolveViewer } from "@/lib/ecosystem/feed";
import { FEED_FILTERS, FEED_FILTER_LABEL, parseFeedFilter, typesForFilter } from "@/lib/ecosystem/feedCore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Community feed",
  description: "Educational videos, organizations, projects and opportunities from the AAICBI community.",
};

const PAGE = 12;

/** /feed — the mixed community feed. Dark (404) until SUPER_ADMIN switches the feed on. */
export default async function FeedPage({ searchParams }: { searchParams: { type?: string; n?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.feed || !flags.orgPages) notFound();

  const filter = parseFeedFilter(searchParams.type);
  const count = Math.min(Math.max(parseInt(searchParams.n ?? "", 10) || PAGE, PAGE), 60);
  const viewer = await resolveViewer(await getSession());
  // Education videos stay hidden from the feed while that switch is off.
  const types = typesForFilter(filter).filter((t) => t !== "learn" || flags.education);
  const items = await buildFeed(types, viewer, count + 1);
  const hasMore = items.length > count && count < 60;
  const shown = items.slice(0, count);
  const href = (type: string, n?: number) => `/feed?${new URLSearchParams({ ...(type !== "all" && { type }), ...(n && { n: String(n) }) }).toString()}`;

  return (
    <>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Trainee Login", href: "/trainee/login" }]} />
      <EcosystemSubnav active="feed" feedEnabled />
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <h1 className="sr-only">Community feed</h1>
        <nav aria-label="Feed filters" className="flex gap-2 overflow-x-auto pb-1">
          {FEED_FILTERS.map((f) => (
            <Link
              key={f}
              href={href(f)}
              aria-current={filter === f ? "page" : undefined}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${filter === f ? "border-brand-teal bg-brand-mint text-brand-tealDeep" : "border-brand-gray text-gray-700"}`}
            >
              {FEED_FILTER_LABEL[f]}
            </Link>
          ))}
        </nav>

        <div className="mt-5 space-y-6">
          {shown.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description={filter === "jobs" && !viewer.canBrowseJobs ? "Jobs are shown to signed-in trainees who have turned on discoverability." : "Check back soon."}
            />
          ) : (
            shown.map((item) => <FeedCard key={item.key} item={item} />)
          )}
        </div>

        {hasMore && (
          <div className="mt-8 text-center">
            <Link href={href(filter, count + PAGE)} className="text-sm font-semibold text-brand-teal hover:underline">Show more</Link>
          </div>
        )}
      </main>
    </>
  );
}
