import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AvatarFallback from "@/components/ui/AvatarFallback";
import Icon from "@/components/ui/Icon";
import HomeHeader, { type Summary } from "@/components/ecosystem/HomeHeader";
import SocialProvider from "@/components/posts/SocialProvider";
import FeedList from "@/components/posts/FeedList";
import FollowButton from "@/components/posts/FollowButton";
import { ComposeBox, ComposeFab } from "@/components/posts/ComposeEntry";
import DiscoverFeed from "@/app/feed/DiscoverFeed";
import { getSession } from "@/lib/auth/session";
import { dashboardHrefFor } from "@/lib/auth/home";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { actorOf, feedPage, suggestions, trendingTags } from "@/lib/posts/interactions";
import { publicFeedFirstPage, publicSuggestions, publicTrendingTags } from "@/lib/posts/publicFeed";
import { cardsFor } from "@/lib/profiles/card";
import { parseTab, type FeedTab } from "@/lib/posts/interactionCore";

const TABS: Array<[FeedTab, string]> = [["latest", "Latest"], ["following", "Following"], ["discover", "Discover"]];

/**
 * The ecosystem feed as a page. It is the home page (`/`) and also lives at `/feed`. Anyone can read it; reacting,
 * commenting, following, saving and posting ask a visitor for an account. Visitors are served a short-lived shared copy
 * of the first page, signed-in people get their own view. `base` is the address the tab links stay on.
 */
export default async function FeedHome({ searchParams, base }: { searchParams: { tab?: string; type?: string; n?: string }; base: "/" | "/feed" }) {
  const flags = await getEcosystemFlags();
  const session = await getSession();
  const actor = await actorOf(session);
  const tab = parseTab(searchParams.tab);
  const visitorLatest = !actor && tab === "latest";
  const [tags, people] = await Promise.all([visitorLatest || !actor ? publicTrendingTags() : trendingTags(), actor ? suggestions(actor, 4) : publicSuggestions()]);
  const page = visitorLatest ? await publicFeedFirstPage() : tab === "latest" || (tab === "following" && actor) ? await feedPage({ tab: tab === "following" ? "following" : "latest", actor }) : null;
  const [card, dashboard] = actor && session ? await Promise.all([cardsFor([actor.profile]).then((m) => m.get(actor.profile.id) ?? null), dashboardHrefFor(session)]) : [null, null];
  const initial = card?.name?.charAt(0).toUpperCase() || "A";
  const me: Summary = actor && dashboard ? { signedIn: true, name: card?.name ?? actor.session.email, avatarUrl: card?.avatarUrl ?? null, square: card?.square ?? false, handle: actor.profile.handle, kindLabel: card?.kindLabel ?? null, dashboardHref: dashboard } : { signedIn: false };
  const tabHref = (t: FeedTab) => (t === "latest" ? base : `${base}?tab=${t}`);

  return (
    <SocialProvider signedIn={!!actor}>
      <HomeHeader initial={me} />
      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block">
          <nav aria-label="Your space" className="sticky top-32 space-y-1 rounded-3xl border border-brand-gray bg-card-gradient p-3">
            {dashboard && (
              <Link href={dashboard} className="mb-2 flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-brand-teal px-4 text-sm font-semibold text-brand-teal hover:bg-brand-mint"><Icon icon={LayoutDashboard} size="sm" />Go to my dashboard</Link>
            )}
            <Link href="/compose" className="mb-2 flex min-h-[44px] items-center justify-center rounded-full bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Write a post</Link>
            {(actor ? [["/my-posts", "My posts"], ["/saved", "Saved posts"], ["/certificate", "Verify a certificate"]] : [["/organizations", "Training organizations"], ["/jobs", "Jobs and opportunities"], ["/startups", "Startups"], ["/certificate", "Verify a certificate"]]).map(([h, l]) => <Link key={h} href={h} className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint">{l}</Link>)}
          </nav>
        </aside>

        <section aria-label="Feed" className="min-w-0">
          <h1 className="sr-only">AAICBI ecosystem feed</h1>
          {!actor && (
            <div className="mb-4 rounded-3xl bg-card-gradient p-5 text-brand-ink">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-tealDeep">Africa&rsquo;s AI Capacity Building Initiative</p>
              <p className="mt-1 font-display text-xl font-semibold">Where African AI talent, training, jobs and investment meet.</p>
              <p className="mt-2 text-sm">Trainees build skills and a track record. Training organizations teach and show their work. Employers find people with evidence. Startups and investors discover each other. You can read everything below without an account.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/join" className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Create an account <Icon icon={ArrowRight} size="sm" /></Link>
                <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-full border border-brand-teal px-5 text-sm font-semibold text-brand-teal hover:bg-brand-surface">Log in</Link>
                <Link href="/about" className="inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-brand-ink underline-offset-4 hover:underline">About AAICBI</Link>
              </div>
            </div>
          )}
          <ComposeBox initial={initial} />
          <nav aria-label="Feed tabs" className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {TABS.map(([t, l]) => <Link key={t} href={tabHref(t)} aria-current={tab === t ? "page" : undefined} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-brand-teal text-brand-onAccent" : "border border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"}`}>{l}</Link>)}
          </nav>
          <div className="mt-3">
            {tab === "discover" ? <DiscoverFeed searchParams={searchParams} session={session} flags={flags} />
              : tab === "following" && !actor ? <Card><p className="font-semibold text-brand-ink">Posts from people you follow</p><p className="mt-1 text-sm text-gray-700">Create an account, follow people, organizations and startups, and their posts gather here.</p></Card>
              : page && page.posts.length > 0 ? <FeedList initial={page.posts} next={page.next} tab={tab === "following" ? "following" : "latest"} />
              : <EmptyState title={tab === "following" ? "Nothing from the people you follow yet" : "No posts yet"} description={tab === "following" ? "Follow people, organizations and startups to see their posts here. Try the suggestions on the right." : "Nothing has been published yet. Be the first to share something."} />}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start" aria-label="Suggestions">
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
