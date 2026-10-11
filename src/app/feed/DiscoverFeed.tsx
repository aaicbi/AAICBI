import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import FeedCard from "@/components/ecosystem/FeedCards";
import { buildFeed, resolveViewer } from "@/lib/ecosystem/feed";
import { FEED_FILTERS, FEED_FILTER_LABEL, parseFeedFilter, typesForFilter } from "@/lib/ecosystem/feedCore";
import type { EcosystemFlags } from "@/lib/ecosystem/flags";

const PAGE = 12;

/** The "Discover" tab: videos, organizations, projects and opportunities from across the community (the earlier mixed feed). */
export default async function DiscoverFeed({ searchParams, session, flags }: { searchParams: { type?: string; n?: string }; session: { userId: string; role: string } | null; flags: EcosystemFlags }) {
  const filter = parseFeedFilter(searchParams.type);
  const count = Math.min(Math.max(parseInt(searchParams.n ?? "", 10) || PAGE, PAGE), 60);
  const viewer = await resolveViewer(session);
  const types = typesForFilter(filter).filter((t) => t !== "learn" || flags.education);
  const items = await buildFeed(types, viewer, count + 1);
  const hasMore = items.length > count && count < 60;
  const shown = items.slice(0, count);
  const href = (type: string, n?: number) => `/feed?${new URLSearchParams({ tab: "discover", ...(type !== "all" && { type }), ...(n && { n: String(n) }) }).toString()}`;
  return (
    <div>
      <nav aria-label="Discover filters" className="flex gap-2 overflow-x-auto pb-1">
        {FEED_FILTERS.map((f) => (
          <Link key={f} href={href(f)} aria-current={filter === f ? "page" : undefined} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${filter === f ? "border-brand-teal bg-brand-mint text-brand-tealDeep" : "border-brand-gray text-gray-700"}`}>{FEED_FILTER_LABEL[f]}</Link>
        ))}
      </nav>
      <div className="mt-5 space-y-6">
        {shown.length === 0 ? <EmptyState title="Nothing here yet" description={filter === "jobs" && !viewer.canBrowseJobs ? "Jobs are shown to signed-in trainees who have turned on discoverability." : "Check back soon."} /> : shown.map((item) => <FeedCard key={item.key} item={item} />)}
      </div>
      {hasMore && <div className="mt-8 text-center"><Link href={href(filter, count + PAGE)} className="text-sm font-semibold text-brand-teal hover:underline">Show more</Link></div>}
    </div>
  );
}
