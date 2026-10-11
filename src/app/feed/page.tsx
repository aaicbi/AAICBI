import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AvatarFallback from "@/components/ui/AvatarFallback";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import SocialProvider from "@/components/posts/SocialProvider";
import FeedList from "@/components/posts/FeedList";
import FollowButton from "@/components/posts/FollowButton";
import { ComposeBox, ComposeFab } from "@/components/posts/ComposeEntry";
import DiscoverFeed from "./DiscoverFeed";
import { getSession } from "@/lib/auth/session";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { actorOf, feedPage, suggestions, trendingTags } from "@/lib/posts/interactions";
import { cardsFor } from "@/lib/profiles/card";
import { parseTab, type FeedTab } from "@/lib/posts/interactionCore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Community feed",
  description: "Posts, videos, projects and opportunities from the AAICBI community. Open to read; create an account to take part.",
};

const TABS: Array<[FeedTab, string]> = [["latest", "Latest"], ["following", "Following"], ["discover", "Discover"]];

/** /feed: the community feed. Anyone can read it; reacting, commenting, following, saving and posting ask for an account. Dark (404) until a super admin switches the feed on. */
export default async function FeedPage({ searchParams }: { searchParams: { tab?: string; type?: string; n?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.feed || !flags.orgPages) notFound();
  const session = await getSession();
  const actor = await actorOf(session);
  const tab = parseTab(searchParams.tab);
  const [tags, people] = await Promise.all([trendingTags(), suggestions(actor, 4)]);
  const page = tab === "latest" || (tab === "following" && actor) ? await feedPage({ tab: tab === "following" ? "following" : "latest", actor }) : null;
  const initial = (actor ? (await cardsFor([actor.profile])).get(actor.profile.id)?.name : "")?.charAt(0).toUpperCase() || "A";

  return (
    <SocialProvider signedIn={!!actor}>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Trainee Login", href: "/trainee/login" }]} />
      <EcosystemSubnav active="feed" feedEnabled />
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block">
          <nav aria-label="Your space" className="sticky top-16 space-y-1 rounded-3xl border border-brand-gray bg-brand-surface p-3">
            <Link href="/compose" className="mb-2 flex min-h-[44px] items-center justify-center rounded-full bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Write a post</Link>
            {[["/my-posts", "My posts"], ["/saved", "Saved posts"], ["/search", "Search"], ["/startups", "Startups"], ["/organizations", "Organizations"]].map(([h, l]) => <Link key={h} href={h} className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint">{l}</Link>)}
            {!actor && <p className="px-3 pt-2 text-xs text-gray-600">Read freely. <Link href="/trainee/register?next=%2Ffeed" className="font-semibold text-brand-teal hover:underline">Create an account</Link> to take part.</p>}
          </nav>
        </aside>

        <section aria-label="Feed" className="min-w-0">
          <h1 className="sr-only">Community feed</h1>
          {!actor && (
            <div className="mb-4 rounded-3xl bg-gradient-to-r from-brand-mint to-brand-goldLight p-4 text-sm text-brand-ink">
              <p className="font-semibold">Join the AAICBI community</p>
              <p className="mt-1">Create a free account to react, comment, follow and post. You can keep reading without one.</p>
              <div className="mt-3 flex flex-wrap gap-2"><Link href="/trainee/register?next=%2Ffeed" className="inline-flex min-h-[44px] items-center rounded-full bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent">Create account</Link><Link href="/trainee/login?next=%2Ffeed" className="inline-flex min-h-[44px] items-center rounded-full border border-brand-teal px-5 text-sm font-semibold text-brand-teal">Sign in</Link></div>
            </div>
          )}
          <ComposeBox initial={initial} />
          <nav aria-label="Feed tabs" className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {TABS.map(([t, l]) => <Link key={t} href={`/feed?tab=${t}`} aria-current={tab === t ? "page" : undefined} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-brand-teal text-brand-onAccent" : "border border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"}`}>{l}</Link>)}
          </nav>
          <div className="mt-3">
            {tab === "discover" ? <DiscoverFeed searchParams={searchParams} session={session} flags={flags} />
              : tab === "following" && !actor ? <Card><p className="font-semibold text-brand-ink">Posts from people you follow</p><p className="mt-1 text-sm text-gray-700">Create an account, follow people, organizations and startups, and their posts gather here.</p></Card>
              : page && page.posts.length > 0 ? <FeedList initial={page.posts} next={page.next} tab={tab === "following" ? "following" : "latest"} />
              : <EmptyState title={tab === "following" ? "Nothing from the people you follow yet" : "No posts yet"} description={tab === "following" ? "Follow people, organizations and startups to see their posts here. Try the suggestions on the right." : "Be the first to share something."} />}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start" aria-label="Suggestions">
          {people.length > 0 && (
            <Card>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Who to follow</h2>
              <ul className="mt-3 space-y-3">
                {people.map((p) => (
                  <li key={p.profileId} className="flex items-center gap-3">
                    <Link href={`/@${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-brand-mint ${p.square ? "rounded-xl" : "rounded-full"}`}>{p.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.avatarUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant="company" size="sm" />}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-brand-ink">{p.name}</span><span className="block truncate text-xs text-gray-600">{p.kindLabel}{p.followers > 0 ? ` · ${p.followers} follower${p.followers === 1 ? "" : "s"}` : ""}</span></span>
                    </Link>
                    <FollowButton profileId={p.profileId} initial={false} name={p.name} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {tags.length > 0 && (
            <Card>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Topics this week</h2>
              <ul className="mt-3 flex flex-wrap gap-2">{tags.map((t) => <li key={t.tag}><Link href={`/tags/${encodeURIComponent(t.tag)}`} className="inline-flex min-h-[36px] items-center rounded-full border border-brand-gray px-3 text-xs font-semibold text-brand-ink hover:border-brand-teal">#{t.tag}<span className="ml-1.5 text-gray-600">{t.people}</span></Link></li>)}</ul>
              <p className="mt-2 text-xs text-gray-600">Counted by how many different people posted about it.</p>
            </Card>
          )}
        </aside>
      </main>
      <ComposeFab />
    </SocialProvider>
  );
}
