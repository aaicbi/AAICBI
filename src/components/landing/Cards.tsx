import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, BadgeCheck, Briefcase, PlayCircle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import SampleTag from "@/components/landing/SampleTag";
import { PersonAvatar } from "@/components/landing/art/People";
import { VideoScene } from "@/components/landing/art/Scenes";
import { closesIn } from "@/lib/landing/core";
import type { LandingEvent, LandingJob, LandingOrg, LandingProgram, LandingTrainee, LandingVideo } from "@/lib/landing/types";

/**
 * The cards on the landing page. Each one is a single link (the title,
 * stretched over the card) so there is one tab stop per card. A card that
 * is an example says so with a tag and its call to action says what the
 * visitor can do ("List your program"), never "view".
 */

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

const card = "relative flex h-full flex-col rounded-xl border bg-brand-surface p-4 transition-colors focus-within:ring-2 focus-within:ring-brand-teal hover:border-brand-teal";
const real = "border-brand-gray";
const sample = "border-dashed border-gray-400";

function Title({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-display text-base font-semibold leading-snug text-brand-ink after:absolute after:inset-0 after:rounded-xl focus:outline-none">
      {children}
    </Link>
  );
}

function Cta({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-teal">
      {children} <Icon icon={ArrowRight} size="sm" />
    </span>
  );
}

function Chips({ items }: { items: Array<string | null | undefined> }) {
  const list = items.filter((i): i is string => !!i);
  if (list.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {list.map((i) => (
        <li key={i}>
          <Badge variant="neutral">{i}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function ProgramCard({ p }: { p: LandingProgram }) {
  return (
    <article className={`${card} ${p.isSample ? sample : real}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-teal">{p.category ?? "Training program"}</span>
        {p.isSample && <SampleTag />}
      </div>
      <h3 className="mt-2">
        <Title href={p.href}>{p.title}</Title>
      </h3>
      {p.organizationName && <p className="mt-1 text-xs text-gray-600">{p.organizationName}</p>}
      {p.description && <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.description}</p>}
      <Chips items={[p.level, p.duration, p.format, p.priceLabel]} />
      <Cta>{p.isSample ? "List your program" : "View program"}</Cta>
    </article>
  );
}

export function JobCard({ j }: { j: LandingJob }) {
  const closes = closesIn(j.closingDate);
  return (
    <article className={`${card} ${j.isSample ? sample : real}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-teal">
          <Icon icon={Briefcase} size="sm" /> Opportunity
        </span>
        {j.isSample && <SampleTag />}
      </div>
      <h3 className="mt-2">
        <Title href={j.href}>{j.title}</Title>
      </h3>
      <p className="mt-1 text-xs text-gray-600">{j.company}</p>
      {j.summary && <p className="mt-2 text-sm leading-relaxed text-gray-600">{j.summary}</p>}
      <Chips items={[...j.skills.slice(0, 3), closes]} />
      <Cta>{j.isSample ? "Post an opportunity" : "View role"}</Cta>
    </article>
  );
}

export function OrgCard({ o }: { o: LandingOrg }) {
  return (
    <article className={`${card} ${o.isSample ? sample : real}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-brand-mint text-lg font-semibold text-brand-teal" aria-hidden="true">
          {o.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- organization logo of unknown size and host.
            <img src={o.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            o.name.replace(/^Example\s+/, "").charAt(0)
          )}
        </div>
        {o.isSample ? <SampleTag /> : o.featured ? <Badge variant="success">Featured</Badge> : null}
      </div>
      <h3 className="mt-3">
        <Title href={o.href}>{o.name}</Title>
      </h3>
      {o.verified && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-teal">
          <Icon icon={BadgeCheck} size="sm" /> Verified training organization
        </p>
      )}
      {o.location && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
          <Icon icon={MapPin} size="sm" /> {o.location}
        </p>
      )}
      {o.tagline && <p className="mt-2 text-sm leading-relaxed text-gray-600">{o.tagline}</p>}
      <Chips items={o.skills.slice(0, 3)} />
      <Cta>{o.isSample ? "Register your organization" : "Visit page"}</Cta>
    </article>
  );
}

export function TraineeCard({ t }: { t: LandingTrainee }) {
  return (
    <article className={`${card} ${t.isSample ? sample : real}`}>
      <div className="flex items-start justify-between gap-2">
        {t.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- trainee-chosen photo of unknown size and host.
          <img src={t.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" loading="lazy" />
        ) : t.isSample ? (
          <PersonAvatar seed={t.avatarSeed} size={56} />
        ) : (
          // A real person with no photo gets their initials, never a drawn stranger.
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-mint text-lg font-semibold text-brand-teal" aria-hidden="true">
            {initials(t.name)}
          </span>
        )}
        {t.isSample ? <SampleTag /> : t.openToWork ? <Badge variant="success">Open to work</Badge> : null}
      </div>
      <h3 className="mt-3">
        <Title href={t.href}>{t.name}</Title>
      </h3>
      {t.location && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
          <Icon icon={MapPin} size="sm" /> {t.location}
        </p>
      )}
      <Chips items={t.skills.slice(0, 4)} />
      <Cta>{t.isSample ? "Create your profile" : "View profile"}</Cta>
    </article>
  );
}

export function EventCard({ e }: { e: LandingEvent }) {
  const when = e.startsAt
    ? new Date(e.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    : null;
  return (
    <article className={`${card} ${e.isSample ? sample : real}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-teal">
          <Icon icon={CalendarDays} size="sm" /> {when ?? "Event"}
        </span>
        {e.isSample && <SampleTag />}
      </div>
      <h3 className="mt-2">
        <Title href={e.href}>{e.title}</Title>
      </h3>
      <p className="mt-1 text-xs text-gray-600">{e.organizationName}</p>
      {e.locationText && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
          <Icon icon={MapPin} size="sm" /> {e.locationText}
        </p>
      )}
      <Cta>{e.isSample ? "Announce an event" : "See event"}</Cta>
    </article>
  );
}

export function VideoCard({ v, index }: { v: LandingVideo; index: number }) {
  const c = v.card;
  return (
    <article className={`${card} overflow-hidden p-0 ${v.isSample ? sample : real}`}>
      <div className="relative aspect-video w-full overflow-hidden bg-brand-mint">
        {v.isSample ? (
          <VideoScene seed={index + 4} className="h-full w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail.
          <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-ink/70 text-white">
            <Icon icon={PlayCircle} size="md" />
          </span>
        </span>
        {v.isSample && <SampleTag className="absolute left-2 top-2 border-solid bg-brand-surface" />}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3>
          <Title href={v.href}>{c.title}</Title>
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          {v.isSample ? "Presented by a trainee" : `Presented by ${c.traineeName}`} · {c.organizationName}
        </p>
        <Chips items={c.skills.slice(0, 3)} />
        <Cta>{v.isSample ? "Share a video" : "Watch"}</Cta>
      </div>
    </article>
  );
}

/** A row that swipes on phones and becomes a grid from the small breakpoint up. */
export function Rail({ label, children }: { label: string; children: React.ReactNode[] }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-6 snap-x snap-mandatory scroll-px-6 overflow-x-auto px-6 pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal sm:mx-0 sm:scroll-px-0 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      <ul className="flex gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child, i) => (
          <li key={i} className="w-[82%] shrink-0 snap-start sm:w-auto">
            {child}
          </li>
        ))}
      </ul>
    </div>
  );
}
