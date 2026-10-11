import Link from "next/link";
import type { Metadata } from "next";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AvatarFallback from "@/components/ui/AvatarFallback";
import { publicStartups } from "@/lib/startups/startups";
import { INDUSTRIES, STAGE_LABEL } from "@/lib/startups/startupCore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Startups", description: "Startups from the AAICBI community, approved by the AAICBI team." };

/** /startups: the public directory. Only approved startups appear; anyone can browse. */
export default async function StartupsPage({ searchParams }: { searchParams: { q?: string; industry?: string } }) {
  const q = (searchParams.q ?? "").trim().slice(0, 60) || undefined;
  const industry = (INDUSTRIES as readonly string[]).includes(searchParams.industry ?? "") ? searchParams.industry : undefined;
  const list = await publicStartups({ q, industry });
  const flags = await getEcosystemFlags();
  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Startups</h1>
        <p className="mt-1 text-sm text-gray-700">Startups founded by AAICBI members. Each one is reviewed by the AAICBI team before it appears here.</p>
        <form action="/startups" className="mt-4 flex flex-wrap gap-2" role="search">
          <label htmlFor="q" className="sr-only">Search startups</label>
          <input id="q" name="q" defaultValue={q ?? ""} maxLength={60} placeholder="Search by name or what they do" className="min-h-[44px] min-w-[200px] flex-1 rounded-full border border-brand-gray bg-brand-surface px-4 text-sm text-brand-ink" />
          <label htmlFor="industry" className="sr-only">Industry</label>
          <select id="industry" name="industry" defaultValue={industry ?? ""} className="min-h-[44px] rounded-full border border-brand-gray bg-brand-surface px-4 text-sm text-brand-ink"><option value="">All industries</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</select>
          <button type="submit" className="min-h-[44px] rounded-full bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent">Search</button>
        </form>
        {list.length === 0 ? <div className="mt-8"><EmptyState title="No startups found" description={q || industry ? "Try a different word or industry." : "No startup has been approved yet."} /></div> : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {list.map((s) => (
              <li key={s.id}>
                <Link href={s.handle ? `/@${s.handle}` : "/startups"} className="block h-full">
                  <Card interactive className="flex h-full gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-mint">{s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant="company" size="md" />}</span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-display font-semibold text-brand-ink">{s.name}</span>{s.verified && <Badge variant="success">Verified</Badge>}</span>
                      {s.tagline && <span className="mt-1 block break-words text-sm text-gray-700">{s.tagline}</span>}
                      <span className="mt-2 flex flex-wrap gap-1.5">{[s.industry, STAGE_LABEL[s.stage], s.location].filter(Boolean).map((c) => <span key={c as string} className="rounded-full border border-brand-gray px-2.5 py-0.5 text-xs font-semibold text-gray-700">{c}</span>)}</span>
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
