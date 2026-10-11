import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import BackLink from "@/components/ui/BackLink";
import AvatarFallback from "@/components/ui/AvatarFallback";
import { getSession } from "@/lib/auth/session";
import { profileHref } from "@/lib/profiles/profiles";
import { resolveHandle } from "@/lib/profiles/handleChanges";
import { kindLabel, loadProfileView } from "@/lib/profiles/view";

export const dynamic = "force-dynamic";

async function load(rawHandle: string) {
  const found = await resolveHandle(decodeURIComponent(rawHandle).toLowerCase());
  if (!found) return null;
  const view = await loadProfileView(found.profile, await getSession());
  // A hidden profile and an unknown one look the same, former handle or not.
  return view ? { view, former: found.former, current: found.profile.handle } : null;
}

/** Where "back" goes: a signed-in person's own dashboard, otherwise the feed. */
function backTarget(role: string | null): { href: string; label: string } {
  if (role === "TRAINEE") return { href: "/trainee/dashboard", label: "Back to Dashboard" };
  if (role === "EMPLOYER") return { href: "/employer/dashboard", label: "Back to Dashboard" };
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "INSTRUCTOR") return { href: "/admin/dashboard", label: "Back to Dashboard" };
  return { href: "/feed", label: "Back to feed" };
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const loaded = await load(params.handle);
  const v = loaded?.view;
  // Unknown and hidden profiles look the same, so nothing leaks through the title.
  if (!v) return { title: "Profile not found", robots: { index: false } };
  return { title: `${v.name} (@${v.handle})`, description: v.headline ?? `${kindLabel(v.kind)} on AAICBI` };
}

/** /@handle (rewritten to /p/handle): the one profile page for every kind of account. */
export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const loaded = await load(params.handle);
  if (!loaded) notFound();
  // A former handle forwards for good (308), so links and search engines move to the new address.
  if (loaded.former) permanentRedirect(profileHref(loaded.current));
  const v = loaded.view;
  const back = backTarget((await getSession())?.role ?? null);
  const square = v.kind !== "PERSON" && v.kind !== "STAFF";

  return (
    <>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Feed", href: "/feed" }]} />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <BackLink href={back.href}>{back.label}</BackLink>
        <div className="mt-3 h-36 overflow-hidden rounded-t-2xl bg-gradient-to-r from-brand-teal/70 to-brand-gold/50 sm:h-44">
          {v.coverUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.coverUrl} alt="" className="no-ring h-full w-full object-cover" />}
        </div>
        <Card className="rounded-t-none border-t-0">
          <div className={`-mt-14 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden bg-brand-mint ring-4 ring-brand-surface ${square ? "rounded-2xl" : "rounded-full"}`}>
            {v.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.avatarUrl} alt={`${v.name}`} className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant={square ? "company" : "person"} size="xl" />}
          </div>
          <div className="mt-3 min-w-0">
            <h1 className="break-words font-display text-2xl font-semibold text-brand-ink">{v.name}</h1>
            <p className="text-sm text-gray-600">@{v.handle}{v.location ? ` · ${v.location}` : ""}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{kindLabel(v.kind)}</Badge>
            {v.verified && <Badge variant="success">Verified</Badge>}
            {v.followers !== null && <span className="text-sm text-gray-700"><span className="font-semibold text-brand-ink">{v.followers.toLocaleString("en-GB")}</span> follower{v.followers === 1 ? "" : "s"}</span>}
          </div>
          {v.headline && <p className="mt-3 break-words text-base text-brand-ink">{v.headline}</p>}
          {v.about && <p className="mt-2 whitespace-pre-line break-words text-sm text-gray-700">{v.about}</p>}
          {v.note && <p className="mt-2 text-sm font-semibold text-brand-teal">{v.note}</p>}
          {v.links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Links">
              {v.links.map((l) => <li key={l.href}><a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-teal hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">{l.label}</a></li>)}
            </ul>
          )}
          {v.chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills">
              {v.chips.map((c) => <li key={c} className="rounded-full border border-brand-gray px-3 py-1 text-xs font-semibold text-brand-ink">{c}</li>)}
            </ul>
          )}
          {v.moreHref && (
            <Link href={v.moreHref} className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-brand-teal px-5 text-sm font-semibold text-brand-teal hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
              {v.moreLabel}
            </Link>
          )}
        </Card>
        {v.sections.map((sec) => (
          <Card key={sec.title} className="mt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{sec.title}</h2>
            {sec.style === "list" ? (
              <ul className="mt-2 space-y-2 text-sm text-brand-ink">
                {sec.items.map((i, n) => (
                  <li key={n} className="break-words">
                    {i.href ? (i.internal ? <Link href={i.href} className="font-semibold text-brand-teal hover:underline">{i.primary}</Link> : <a href={i.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-teal hover:underline">{i.primary}</a>) : <span className="font-semibold">{i.primary}</span>}
                    {i.secondary && <span className="block text-xs text-gray-600">{i.secondary}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {sec.items.map((i, n) => <li key={n} className={`rounded-full px-3 py-1 text-xs font-semibold ${sec.style === "gold" ? "bg-brand-goldLight text-brand-goldText" : "bg-brand-mint text-brand-teal"}`}>{i.primary}</li>)}
              </ul>
            )}
          </Card>
        ))}
      </main>
    </>
  );
}
