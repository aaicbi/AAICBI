import Link from "next/link";
import Card from "@/components/ui/Card";
import { orderBlocks, type HomeRole, type MobileBlock, type Stat } from "@/lib/mobile/homeCore";
import MobileMessagesPreview from "@/components/mobile/MobileMessagesPreview";

function Section({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand-ink">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            {linkLabel ?? "See all"}
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

function Stats({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-brand-sand p-3">
          <dd className="font-display text-2xl font-semibold tabular-nums text-brand-ink">{s.value}</dd>
          <dt className="text-xs text-gray-600">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function Block({ b }: { b: MobileBlock }) {
  switch (b.kind) {
    case "welcome":
      return (
        <div>
          <p className="text-sm text-gray-600">{b.greeting}</p>
          <h1 className="font-display text-2xl font-semibold text-brand-ink">{b.name}</h1>
          {b.line && <p className="mt-1 text-sm text-gray-700">{b.line}</p>}
        </div>
      );
    case "alerts":
      return (
        <Section title={b.unread > 0 ? `Alerts (${b.unread} new)` : "Alerts"} href="/notifications">
          {b.items.length === 0 ? (
            <p className="text-sm text-gray-700">You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-1">
              {b.items.map((n, i) => (
                <li key={i}>
                  <Link href={n.href} className="flex min-h-[44px] items-center rounded-lg px-1 text-sm text-brand-ink hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                    <span className="truncate">{n.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      );
    case "event":
      return (
        <Section title="Next event" href={b.href}>
          <p className="font-semibold text-brand-ink">{b.title}</p>
          <p className="text-sm text-gray-700">{b.when}{b.where ? ` · ${b.where}` : ""}</p>
          <p className="text-xs text-gray-600">By {b.by}</p>
        </Section>
      );
    case "course":
      return (
        <Card variant="highlighted" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Continue learning</p>
          <p className="font-display font-semibold text-brand-ink">{b.title}</p>
          <div role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={b.percent} className="h-2 overflow-hidden rounded-full bg-brand-gray">
            <div className="h-full bg-brand-teal" style={{ width: `${b.percent}%` }} />
          </div>
          <p className="text-xs text-gray-600">{b.detail}</p>
          <Link href={b.href} className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-brand-teal px-4 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2">
            Resume
          </Link>
        </Card>
      );
    case "assessment":
      return (
        <Section title="Assessment" href="/trainee/examinations" linkLabel="All">
          <Link href={b.href} className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg text-sm hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
            <span className="min-w-0 truncate font-semibold text-brand-ink">{b.title}</span>
            <span className="shrink-0 text-xs font-semibold text-brand-teal">{b.status}</span>
          </Link>
        </Section>
      );
    case "messages":
      return (
        <Section title="Messages" href={b.href} linkLabel="Open">
          <MobileMessagesPreview href={b.href} />
        </Section>
      );
    case "opportunities":
      return (
        <Section title="Opportunities" href={b.seeAllHref}>
          <ul className="space-y-1">
            {b.items.map((o) => (
              <li key={o.href}>
                <Link href={o.href} className="block min-h-[48px] rounded-lg px-1 py-1 hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                  <span className="block truncate text-sm font-semibold text-brand-ink">{o.title}</span>
                  <span className="block truncate text-xs text-gray-600">{o.by}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      );
    case "talent":
      return (
        <Card variant="highlighted" className="space-y-2">
          <p className="text-sm text-brand-ink">{b.text}</p>
          <Link href={b.href} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">{b.label}</Link>
        </Card>
      );
    case "applications":
      return (
        <Section title="Applications" href={b.href} linkLabel="Review">
          <p className="text-sm text-gray-700">{b.count === 0 ? "No applications yet." : `${b.count} application${b.count === 1 ? "" : "s"} received.`}</p>
        </Section>
      );
    case "trainees":
      return (
        <Section title="Trainees" href={b.href} linkLabel="Overview">
          <Stats stats={b.stats} />
        </Section>
      );
    case "training":
      return (
        <Section title="Training" href={b.href} linkLabel="Courses">
          <Stats stats={b.stats} />
        </Section>
      );
    case "actions":
      return (
        <Section title="Quick actions">
          <ul className="grid grid-cols-2 gap-2">
            {b.items.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="flex min-h-[48px] items-center justify-center rounded-xl border border-brand-gray px-2 text-center text-sm font-semibold text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      );
  }
}

/**
 * The phone home screen for one account: the few things that matter most
 * right now, in order, with big tap targets. The full dashboard is one tap
 * away (see DashboardSwitcher), and laptops never see this.
 */
export default function MobileHome({ role, blocks }: { role: HomeRole; blocks: MobileBlock[] }) {
  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-5">
      {orderBlocks(role, blocks).map((b, i) => (
        <Block key={`${b.kind}-${i}`} b={b} />
      ))}
    </main>
  );
}
