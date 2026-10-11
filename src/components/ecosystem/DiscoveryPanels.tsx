import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, CalendarDays, Rocket, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { closesIn } from "@/lib/landing/core";
import { hasPanels, type DiscoveryPanels as Panels } from "@/lib/ecosystem/discovery";

const STAGE: Record<string, string> = { IDEA: "Idea", PROTOTYPE: "Prototype", MVP: "MVP", LAUNCHED: "Launched", GROWTH: "Growth" };

function Panel({ title, icon, more, moreLabel, children }: { title: string; icon: Parameters<typeof Icon>[0]["icon"]; more: string; moreLabel: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600"><Icon icon={icon} size="sm" />{title}</h2>
      <ul className="mt-3 space-y-3">{children}</ul>
      <Link href={more} className="mt-3 inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-brand-teal hover:underline">{moreLabel} <Icon icon={ArrowRight} size="sm" /></Link>
    </Card>
  );
}

const row = "block min-w-0 rounded-xl py-1 hover:bg-brand-mint/60";
const name = "block truncate text-sm font-semibold text-brand-ink";
const sub = "block truncate text-xs text-gray-600";

/** How AAICBI works, in one short paragraph per kind of member. It is the only static panel. */
export function HowItWorksPanel() {
  return (
    <Card>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">How AAICBI works</h2>
      <ol className="mt-3 space-y-2 text-sm text-brand-ink">
        <li><span className="font-semibold">Learn.</span> Join programs from training organizations and earn certificates anyone can verify.</li>
        <li><span className="font-semibold">Build and share.</span> Post what you are working on and learn in public.</li>
        <li><span className="font-semibold">Get discovered.</span> Employers, organizations and investors find people and startups by evidence.</li>
      </ol>
      <Link href="/join" className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Create an account</Link>
      <Link href="/about" className="mt-1 flex min-h-[36px] items-center justify-center text-sm font-semibold text-brand-teal hover:underline">More about AAICBI</Link>
    </Card>
  );
}

/** The panels around the feed. Only panels with real content appear. */
export default function DiscoveryPanelsView({ panels, signedIn }: { panels: Panels; signedIn: boolean }) {
  return (
    <>
      {panels.organizations.length > 0 && (
        <Panel title="Training organizations" icon={Building2} more="/organizations" moreLabel="All organizations">
          {panels.organizations.map((o) => (
            <li key={o.id}><Link href={o.href} className={row}>
              <span className={name}>{o.name}{o.verified && <Icon icon={BadgeCheck} size="sm" className="ml-1 inline text-brand-teal" aria-label="Verified" />}</span>
              <span className={sub}>{[o.location, o.programCount > 0 ? `${o.programCount} program${o.programCount === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || o.tagline || "Training organization"}</span>
            </Link></li>
          ))}
        </Panel>
      )}
      {panels.jobs.length > 0 && (
        <Panel title="Career opportunities" icon={Briefcase} more="/jobs" moreLabel="All opportunities">
          {panels.jobs.map((j) => {
            const closes = closesIn(j.closingDate);
            return <li key={j.id}><Link href={j.href} className={row}><span className={name}>{j.title}</span><span className={sub}>{j.company}{closes ? ` · ${closes}` : ""}</span></Link></li>;
          })}
        </Panel>
      )}
      {panels.startups.length > 0 && (
        <Panel title="Startup showcase" icon={Rocket} more="/startups" moreLabel="All startups">
          {panels.startups.map((s) => (
            <li key={s.id}><Link href={s.href} className={row}>
              <span className={name}>{s.name}{s.verified && <Icon icon={BadgeCheck} size="sm" className="ml-1 inline text-brand-teal" aria-label="Verified" />}</span>
              <span className={sub}>{[STAGE[s.stage] ?? s.stage, s.industry, s.tagline].filter(Boolean).join(" · ")}</span>
            </Link></li>
          ))}
        </Panel>
      )}
      {panels.events.length > 0 && (
        <Panel title="Upcoming events" icon={CalendarDays} more="/events" moreLabel="All events">
          {panels.events.map((e) => (
            <li key={e.id}><Link href={e.href} className={row}>
              <span className={name}>{e.title}</span>
              <span className={sub}>{[e.startsAt ? new Date(e.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : null, e.organizationName].filter(Boolean).join(" · ")}</span>
            </Link></li>
          ))}
        </Panel>
      )}
      {!signedIn && <HowItWorksPanel />}
    </>
  );
}

export { hasPanels };
