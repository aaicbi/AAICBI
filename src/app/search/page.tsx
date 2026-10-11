import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import EcosystemSubnav from "@/components/ecosystem/EcosystemSubnav";
import EducationVideoCard from "@/components/ecosystem/EducationVideoCard";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { searchEcosystem } from "@/lib/ecosystem/search";
import { searchPeople } from "@/lib/profiles/profileSearch";
import { actorOf, searchPosts } from "@/lib/posts/interactions";
import SocialProvider from "@/components/posts/SocialProvider";
import PostItem from "@/components/posts/PostItem";
import { getSession } from "@/lib/auth/session";
import AvatarFallback from "@/components/ui/AvatarFallback";
import { normalizeQuery, parseKind, SEARCH_KINDS } from "@/lib/ecosystem/searchCore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", robots: { index: false } };

const KIND_LABEL: Record<(typeof SEARCH_KINDS)[number], string> = { all: "All", people: "People", posts: "Posts", organizations: "Organizations", videos: "Videos", programs: "Programs", events: "Events" };

/** /search — organizations, videos, programs and events in one place. */
export default async function SearchPage({ searchParams }: { searchParams: { q?: string; kind?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.orgPages) notFound();
  const q = normalizeQuery(searchParams.q);
  const kind = parseKind(searchParams.kind);
  const results = q ? await searchEcosystem(q, kind, flags) : null;
  // People are found by name, handle or a former handle, and only when their profile can be seen.
  const session = await getSession();
  const people = q && (kind === "all" || kind === "people") ? await searchPeople(q, session) : [];
  // Posts: public, published posts matching the words or a #topic.
  const actor = await actorOf(session);
  const posts = q && (kind === "all" || kind === "posts") ? await searchPosts(q, actor, kind === "posts" ? 20 : 5) : [];
  const total = results ? results.organizations.length + results.videos.length + results.programs.length + results.events.length + people.length + posts.length : 0;

  return (
    <SocialProvider signedIn={!!actor}>
      <SiteHeader nav={[{ label: "Learn", href: "/learn" }, { label: "Organizations", href: "/organizations" }]} />
      <EcosystemSubnav active="search" feedEnabled={flags.feed} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Search</h1>
        <form action="/search" className="mt-4 flex gap-2" role="search">
          <input type="hidden" name="kind" value={kind} />
          <label htmlFor="q" className="sr-only">Search people, organizations, videos, programs and events</label>
          <input id="q" name="q" defaultValue={q ?? searchParams.q ?? ""} maxLength={80} placeholder="Try “data analytics” or “Lagos”" className="min-h-[44px] flex-1 rounded-lg border border-brand-gray bg-white px-3 text-sm" />
          <button type="submit" className="min-h-[44px] rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent">Search</button>
        </form>
        <nav aria-label="Result type" className="mt-3 flex flex-wrap gap-2">
          {SEARCH_KINDS.filter((k) => k !== "videos" || flags.education).map((k) => (
            <Link key={k} href={`/search?q=${encodeURIComponent(q ?? "")}&kind=${k}`} aria-current={kind === k ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === k ? "border-brand-teal bg-brand-mint text-brand-tealDeep" : "border-brand-gray text-gray-600"}`}>{KIND_LABEL[k]}</Link>
          ))}
        </nav>

        {!results && <p className="mt-8 text-sm text-gray-600">Type at least two letters to search.</p>}
        {results && total === 0 && <div className="mt-8"><EmptyState title="Nothing found" description="Try a shorter or different word." /></div>}

        {results && people.length > 0 && (
          <section className="mt-8" aria-labelledby="r-people">
            <h2 id="r-people" className="font-display text-lg font-semibold text-brand-ink">People and organizations</h2>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.handle}>
                  <Link href={`/@${p.handle}`} className="block">
                    <Card interactive className="flex h-full items-center gap-3">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-brand-mint ${p.kind === "PERSON" || p.kind === "STAFF" ? "rounded-full" : "rounded-xl"}`}>
                        {p.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.avatarUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant={p.kind === "PERSON" || p.kind === "STAFF" ? "person" : "company"} size="md" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display font-semibold text-brand-ink">{p.name}</span>
                        <span className="block truncate text-xs text-gray-600">@{p.handle} · {p.kindLabel}</span>
                        {p.formerHandle && <span className="block truncate text-xs text-brand-goldText">Formerly @{p.formerHandle}</span>}
                        {p.headline && <span className="block truncate text-xs text-gray-600">{p.headline}</span>}
                      </span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {results && posts.length > 0 && (
          <section className="mt-8" aria-labelledby="r-posts">
            <h2 id="r-posts" className="font-display text-lg font-semibold text-brand-ink">Posts</h2>
            <ul className="mx-auto mt-3 max-w-xl space-y-4">{posts.map((p) => <li key={p.id}><PostItem post={p} /></li>)}</ul>
            {kind === "all" && posts.length >= 5 && <p className="mt-3 text-sm"><Link href={`/search?q=${encodeURIComponent(q ?? "")}&kind=posts`} className="font-semibold text-brand-teal hover:underline">See all posts</Link></p>}
          </section>
        )}
        {results && results.organizations.length > 0 && (
          <section className="mt-8" aria-labelledby="r-orgs">
            <h2 id="r-orgs" className="font-display text-lg font-semibold text-brand-ink">Organizations</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.organizations.map((o) => (
                <Link key={o.id} href={`/organizations/${o.publicProfile?.slug}`}>
                  <Card interactive className="h-full">
                    <p className="font-display font-semibold text-brand-ink">{o.name}</p>
                    {o.publicProfile?.verified && <VerifiedBadge />}
                    {o.publicProfile?.tagline && <p className="mt-1 text-sm text-gray-700">{o.publicProfile.tagline}</p>}
                    {o.publicProfile?.location && <p className="mt-1 text-xs text-gray-500">{o.publicProfile.location}</p>}
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
        {results && results.videos.length > 0 && (
          <section className="mt-8" aria-labelledby="r-videos">
            <h2 id="r-videos" className="font-display text-lg font-semibold text-brand-ink">Videos</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.videos.map((v) => <EducationVideoCard key={v.id} post={v} />)}</div>
          </section>
        )}
        {results && results.programs.length > 0 && (
          <section className="mt-8" aria-labelledby="r-programs">
            <h2 id="r-programs" className="font-display text-lg font-semibold text-brand-ink">Programs</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.programs.map((c) => (
                <Card key={c.id}>
                  <p className="font-display font-semibold text-brand-ink">{c.title}</p>
                  <p className="text-xs text-gray-600">{[c.organizationName, c.category, c.durationDisplay].filter(Boolean).join(" • ")}</p>
                  <div className="mt-2 flex gap-3 text-sm font-semibold text-brand-teal">
                    <Link href={`/courses/${c.id}`} className="hover:underline">View program</Link>
                    {c.organizationSlug && <Link href={`/organizations/${c.organizationSlug}`} className="hover:underline">View organization</Link>}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
        {results && results.events.length > 0 && (
          <section className="mt-8" aria-labelledby="r-events">
            <h2 id="r-events" className="font-display text-lg font-semibold text-brand-ink">Events</h2>
            <div className="mt-3 space-y-3">
              {results.events.map((e) => (
                <Card key={e.id}>
                  <p className="font-display font-semibold text-brand-ink">{e.title}</p>
                  <p className="text-xs text-gray-600">{e.startsAt.toLocaleDateString("en-GB", { dateStyle: "medium" })} • <Link href={`/organizations/${e.organizationSlug}?tab=events`} className="text-brand-teal hover:underline">{e.organizationName}</Link></p>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </SocialProvider>
  );
}
