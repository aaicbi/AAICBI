import Link from "next/link";
import type { Metadata } from "next";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import EducationVideoCard from "@/components/ecosystem/EducationVideoCard";
import ProfileHitCard from "@/components/ecosystem/ProfileHitCard";
import SocialProvider from "@/components/posts/SocialProvider";
import PostItem from "@/components/posts/PostItem";
import { getSession } from "@/lib/auth/session";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { actorOf } from "@/lib/posts/interactions";
import { runSearch, totalHits, type Paged } from "@/lib/ecosystem/search";
import {
  FILTERS_FOR_KIND, FILTER_LABEL, INDUSTRIES, KIND_LABEL, POST_TYPES, POST_TYPE_LABEL, SEARCH_KINDS, activeFilters, hasCriteria, parseSearchParams, searchHref,
  type SearchKind, type SearchParams,
} from "@/lib/ecosystem/searchCore";
import ExpandSelect from "@/components/ui/ExpandSelect";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", robots: { index: false } };

const FIELD = "min-h-[44px] w-full rounded-xl border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal";

function Section<T>({ id, title, kind, p, page, children }: { id: string; title: string; kind: SearchKind; p: SearchParams; page: Paged<T>; children: React.ReactNode }) {
  if (page.items.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-semibold text-brand-ink">{title}</h2>
        {p.kind === "all" && page.hasMore && <Link href={searchHref(p, { kind, page: 1 })} className="text-sm font-semibold text-brand-teal hover:underline">See all {title.toLowerCase()}</Link>}
      </div>
      {children}
    </section>
  );
}

function Pager({ p, hasMore }: { p: SearchParams; hasMore: boolean }) {
  if (p.kind === "all" || (p.page === 1 && !hasMore)) return null;
  return (
    <nav aria-label="More results" className="mt-6 flex items-center justify-between">
      {p.page > 1 ? <Link href={searchHref(p, { page: p.page - 1 })} rel="prev" className="inline-flex min-h-[44px] items-center rounded-full border border-brand-action px-5 text-sm font-semibold text-brand-action hover:bg-brand-mint">Previous</Link> : <span />}
      <span className="text-sm text-gray-700">Page {p.page}</span>
      {hasMore ? <Link href={searchHref(p, { page: p.page + 1 })} rel="next" className="inline-flex min-h-[44px] items-center rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">Next</Link> : <span />}
    </nav>
  );
}

/**
 * /search: one search across people, organizations, employers, investors, startups, jobs, programs, posts, comments, videos and events.
 * A word, a filter, or both. "All" gives a short preview of each kind; choosing a kind gives its full list, its own filters,
 * a sort and pages. Everything is read by the same public rules as the page each result opens, so nothing private or
 * unapproved can appear. The address always holds the whole request, so a search can be shared or reloaded.
 */
export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const flags = await getEcosystemFlags();
  const p = parseSearchParams(searchParams);
  const session = await getSession();
  const actor = await actorOf(session);
  const asking = p.kind !== "all" || hasCriteria(p);
  const results = asking ? await runSearch(p, flags, session, actor) : null;
  const total = results ? totalHits(results) : 0;
  const shownKinds = SEARCH_KINDS.filter((k) => (k !== "videos" || flags.education) && (k !== "jobs" || flags.publicJobs) && (k !== "posts" || flags.feed) && (k !== "comments" || flags.feed || flags.education) && (flags.orgPages || ["people", "jobs", "posts", "comments"].includes(k) || k === "all"));
  const filters = FILTERS_FOR_KIND[p.kind];
  const active = activeFilters(p);
  const label = KIND_LABEL[p.kind].toLowerCase();

  return (
    <SocialProvider signedIn={!!actor}>
      <HomeHeader initialQuery={p.q ?? ""} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Search</h1>

        <form action="/search" role="search" className="mt-4 rounded-3xl border border-brand-gray bg-card-gradient p-4">
          {p.kind !== "all" && <input type="hidden" name="kind" value={p.kind} />}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="q" className="sr-only">Words to search for</label>
            <input id="q" name="q" defaultValue={p.q ?? ""} maxLength={80} placeholder={p.kind === "all" ? "Try “data analytics”, “Kora” or “Lagos”" : `Search ${label}`} className={`${FIELD} flex-1`} />
            <button type="submit" className="min-h-[44px] rounded-xl bg-brand-action px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-actionHover">Search</button>
          </div>
          {(filters.length > 0 || p.kind !== "all") && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filters.includes("skill") && <div><label htmlFor="skill" className="mb-1 block text-xs font-semibold text-gray-800">{FILTER_LABEL.skill}</label><input id="skill" name="skill" defaultValue={p.skill ?? ""} maxLength={60} placeholder="e.g. Python" className={FIELD} /></div>}
              {filters.includes("location") && <div><label htmlFor="location" className="mb-1 block text-xs font-semibold text-gray-800">{FILTER_LABEL.location}</label><input id="location" name="location" defaultValue={p.location ?? ""} maxLength={60} placeholder="e.g. Lagos" className={FIELD} /></div>}
              {filters.includes("industry") && (
                <div><label htmlFor="industry" className="mb-1 block text-xs font-semibold text-gray-800">{FILTER_LABEL.industry}</label>
                  {p.kind === "startups" ? <ExpandSelect id="industry" name="industry" defaultValue={p.industry ?? ""} className={FIELD}><option value="">Any</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</ExpandSelect> : <input id="industry" name="industry" defaultValue={p.industry ?? ""} maxLength={60} placeholder="e.g. Data" className={FIELD} />}
                </div>
              )}
              {filters.includes("type") && <div><label htmlFor="type" className="mb-1 block text-xs font-semibold text-gray-800">{FILTER_LABEL.type}</label><ExpandSelect id="type" name="type" defaultValue={p.type ?? ""} className={FIELD}><option value="">Any</option>{POST_TYPES.map((t) => <option key={t} value={t}>{POST_TYPE_LABEL[t]}</option>)}</ExpandSelect></div>}
              {p.kind !== "all" && <div><label htmlFor="sort" className="mb-1 block text-xs font-semibold text-gray-800">Sort by</label><ExpandSelect id="sort" name="sort" defaultValue={p.sort} className={FIELD}><option value="relevance">Best match</option><option value="recent">Newest</option></ExpandSelect></div>}
            </div>
          )}
          {active.length > 0 && <p className="mt-3 text-sm text-gray-800">Filtering by {active.map((k) => `${FILTER_LABEL[k].toLowerCase()}: ${p[k]}`).join(", ")}. <Link href={searchHref(p, { skill: null, location: null, industry: null, type: null, page: 1 })} className="font-semibold text-brand-teal hover:underline">Clear filters</Link></p>}
        </form>

        <nav aria-label="Result type" className="mt-3 flex flex-wrap gap-2">
          {shownKinds.map((k) => (
            <Link key={k} href={searchHref(p, { kind: k, page: 1, skill: null, location: null, industry: null, type: null })} aria-current={p.kind === k ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${p.kind === k ? "border-brand-teal bg-brand-mint text-brand-tealDeep" : "border-brand-gray text-gray-800 hover:border-brand-teal"}`}>{KIND_LABEL[k]}</Link>
          ))}
        </nav>

        {!results && (
          <div className="mt-8 rounded-3xl border border-brand-gray bg-card-gradient p-5 text-sm text-gray-800">
            <p className="font-semibold text-brand-ink">Search the whole ecosystem</p>
            <p className="mt-1">Type at least two letters, or choose a type above to browse it. You can find people, organizations, startups, employers, jobs, programs, posts, comments, videos and events.</p>
          </div>
        )}
        {results && total === 0 && (
          <div className="mt-8">
            <EmptyState
              title={p.q ? `Nothing found for “${p.q}”` : "Nothing here yet"}
              description={p.kind === "investors"
                ? "Investor profiles are not public yet, so only the investor and the AAICBI team can find them."
                : active.length > 0 ? "No result matches all of the filters. Try removing one." : p.q ? "Check the spelling, try fewer or shorter words, or search a different type." : "Nothing has been published in this part of the ecosystem yet."}
            />
            <p className="mt-4 text-center text-sm text-gray-700">
              {active.length > 0 && <><Link href={searchHref(p, { skill: null, location: null, industry: null, type: null, page: 1 })} className="font-semibold text-brand-teal hover:underline">Clear the filters</Link> · </>}
              {p.kind !== "all" && p.q && <><Link href={searchHref(p, { kind: "all", page: 1 })} className="font-semibold text-brand-teal hover:underline">Search everything for “{p.q}”</Link> · </>}
              <Link href="/organizations" className="font-semibold text-brand-teal hover:underline">Browse organizations</Link> · <Link href="/jobs" className="font-semibold text-brand-teal hover:underline">Browse jobs</Link> · <Link href="/startups" className="font-semibold text-brand-teal hover:underline">Browse startups</Link>
            </p>
          </div>
        )}

        {results?.people && <Section id="r-people" title="People" kind="people" p={p} page={results.people}><ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{results.people.items.map((h) => <li key={h.handle}><ProfileHitCard hit={h} /></li>)}</ul></Section>}
        {results?.organizations && <Section id="r-orgs" title="Organizations" kind="organizations" p={p} page={results.organizations}><ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{results.organizations.items.map((h) => <li key={h.handle}><ProfileHitCard hit={h} /></li>)}</ul></Section>}
        {results?.startups && <Section id="r-startups" title="Startups" kind="startups" p={p} page={results.startups}><ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{results.startups.items.map((h) => <li key={h.handle}><ProfileHitCard hit={h} /></li>)}</ul></Section>}
        {results?.employers && <Section id="r-employers" title="Employers" kind="employers" p={p} page={results.employers}><ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{results.employers.items.map((h) => <li key={h.handle}><ProfileHitCard hit={h} /></li>)}</ul></Section>}
        {results?.investors && <Section id="r-investors" title="Investors" kind="investors" p={p} page={results.investors}><ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{results.investors.items.map((h) => <li key={h.handle}><ProfileHitCard hit={h} /></li>)}</ul></Section>}
        {results?.jobs && (
          <Section id="r-jobs" title="Jobs" kind="jobs" p={p} page={results.jobs}>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.jobs.items.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="block">
                    <Card interactive className="h-full">
                      <p className="font-display font-semibold text-brand-ink">{j.title}</p>
                      <p className="text-xs text-gray-700">{j.company} · closes {new Date(j.closingDate).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-800">{j.summary}</p>
                      {j.skills.length > 0 && <span className="mt-2 flex flex-wrap gap-1.5">{j.skills.map((s) => <span key={s} className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-semibold text-gray-800">{s}</span>)}</span>}
                      <span className="mt-2 block text-sm font-semibold text-brand-teal">View job</span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {results?.programs && (
          <Section id="r-programs" title="Programs" kind="programs" p={p} page={results.programs}>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.programs.items.map((c) => (
                <Card key={c.id}>
                  <p className="font-display font-semibold text-brand-ink">{c.title}</p>
                  <p className="text-xs text-gray-700">{[c.organizationName, c.category, c.durationDisplay].filter(Boolean).join(" • ")}</p>
                  <div className="mt-2 flex gap-3 text-sm font-semibold text-brand-teal">
                    <Link href={`/courses/${c.id}`} className="hover:underline">View program</Link>
                    {c.organizationSlug && <Link href={`/organizations/${c.organizationSlug}`} className="hover:underline">View organization</Link>}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}
        {results?.posts && <Section id="r-posts" title="Posts" kind="posts" p={p} page={results.posts}><ul className="mx-auto mt-3 max-w-xl space-y-4">{results.posts.items.map((x) => <li key={x.id}><PostItem post={x} /></li>)}</ul></Section>}
        {results?.comments && (
          <Section id="r-comments" title="Comments" kind="comments" p={p} page={results.comments}>
            <ul className="mt-3 space-y-3">
              {results.comments.items.map((c) => (
                <li key={`${c.on}-${c.id}`}>
                  <Link href={c.href} className="block">
                    <Card interactive>
                      <p className="text-xs text-gray-700"><span className="font-semibold text-brand-ink">{c.authorName}</span> commented on {c.on === "video" ? "the video" : "the post"} <span className="italic">&ldquo;{c.context}&rdquo;</span> · {new Date(c.at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
                      <p className="mt-1 text-sm text-brand-ink">{c.body}</p>
                      <span className="mt-1 block text-sm font-semibold text-brand-teal">Open the conversation</span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {results?.videos && <Section id="r-videos" title="Videos" kind="videos" p={p} page={results.videos}><div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.videos.items.map((v) => <EducationVideoCard key={v.id} post={v} />)}</div></Section>}
        {results?.events && (
          <Section id="r-events" title="Events" kind="events" p={p} page={results.events}>
            <div className="mt-3 space-y-3">
              {results.events.items.map((e) => (
                <Card key={e.id}>
                  <p className="font-display font-semibold text-brand-ink">{e.title}</p>
                  <p className="text-xs text-gray-700">{e.startsAt.toLocaleDateString("en-GB", { dateStyle: "medium" })} • <Link href={`/organizations/${e.organizationSlug}?tab=events`} className="text-brand-teal hover:underline">{e.organizationName}</Link></p>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {results && p.kind !== "all" && <Pager p={p} hasMore={Object.values(results).some((v) => v?.hasMore)} />}
      </main>
    </SocialProvider>
  );
}
