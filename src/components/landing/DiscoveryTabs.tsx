"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { EventCard, JobCard, OrgCard, ProgramCard, Rail, TraineeCard, VideoCard } from "@/components/landing/Cards";
import type { LandingView } from "@/lib/landing/types";

type TabKey = "training" | "opportunities" | "organizations" | "trainees" | "events" | "videos";

interface TabDef {
  key: TabKey;
  label: string;
  seeAll: { label: string; href: string };
  /** What a visitor can do while the list shows examples. */
  invite: { text: string; label: string; href: string };
}

const TAB_DEFS: TabDef[] = [
  { key: "training", label: "Training", seeAll: { label: "Browse all programs", href: "/courses" }, invite: { text: "Training organizations list their programs here.", label: "Register your organization", href: "/org/register" } },
  { key: "opportunities", label: "Opportunities", seeAll: { label: "See all opportunities", href: "/jobs" }, invite: { text: "Employers post open roles here.", label: "Register as an employer", href: "/employer/register" } },
  { key: "organizations", label: "Organizations", seeAll: { label: "Meet all organizations", href: "/organizations" }, invite: { text: "Training organizations appear here once they publish a page.", label: "Register your organization", href: "/org/register" } },
  { key: "trainees", label: "Trainees", seeAll: { label: "Explore all trainees", href: "/trainees" }, invite: { text: "Trainees who choose a public profile appear here.", label: "Create a trainee account", href: "/trainee/register" } },
  { key: "events", label: "Events", seeAll: { label: "See all events", href: "/events" }, invite: { text: "Organizations announce open days and workshops here.", label: "Register your organization", href: "/org/register" } },
  { key: "videos", label: "Videos", seeAll: { label: "Watch all videos", href: "/learn" }, invite: { text: "Trainees present educational videos for their organization here.", label: "Create a trainee account", href: "/trainee/register" } },
];

export interface DiscoveryProps {
  view: Pick<LandingView, "programs" | "jobs" | "organizations" | "trainees" | "events" | "videos">;
  show: { jobs: boolean; organizations: boolean; trainees: boolean; events: boolean; videos: boolean };
}

export default function DiscoveryTabs({ view, show }: DiscoveryProps) {
  const visible = TAB_DEFS.filter((t) => {
    if (t.key === "opportunities") return show.jobs && view.jobs.length > 0;
    if (t.key === "organizations") return show.organizations && view.organizations.length > 0;
    if (t.key === "trainees") return show.trainees && view.trainees.length > 0;
    if (t.key === "events") return show.events && view.events.length > 0;
    if (t.key === "videos") return show.videos && view.videos.length > 0;
    return view.programs.length > 0;
  });
  const [active, setActive] = useState<TabKey>(visible[0]?.key ?? "training");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  if (visible.length === 0) return null;
  const def = visible.find((t) => t.key === active) ?? visible[0];

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const move = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!move && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? visible.length - 1 : (index + move + visible.length) % visible.length;
    setActive(visible[next].key);
    refs.current[visible[next].key]?.focus();
  }

  const hasSamples = (() => {
    switch (def.key) {
      case "training": return view.programs.some((p) => p.isSample);
      case "opportunities": return view.jobs.some((p) => p.isSample);
      case "organizations": return view.organizations.some((p) => p.isSample);
      case "trainees": return view.trainees.some((p) => p.isSample);
      case "events": return view.events.some((p) => p.isSample);
      default: return view.videos.some((p) => p.isSample);
    }
  })();

  return (
    <section id="ecosystem" aria-labelledby="discover-heading" className="scroll-mt-20 border-t border-brand-gray">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h2 id="discover-heading" className="font-display text-2xl font-semibold text-brand-ink">
          Explore the ecosystem
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">Training, opportunities, organizations and people. Open anything; you only need an account to apply, follow or get in touch.</p>

        <div role="tablist" aria-label="Explore" className="-mx-6 mt-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {visible.map((t, i) => {
            const selected = t.key === def.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  refs.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`disc-tab-${t.key}`}
                aria-selected={selected}
                aria-controls="disc-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.key)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                  selected ? "border-brand-teal bg-brand-teal text-brand-onAccent" : "border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div id="disc-panel" role="tabpanel" aria-labelledby={`disc-tab-${def.key}`} className="mt-6">
          {def.key === "training" && <Rail label="Training programs">{view.programs.map((p) => <ProgramCard key={p.id} p={p} />)}</Rail>}
          {def.key === "opportunities" && <Rail label="Opportunities">{view.jobs.map((j) => <JobCard key={j.id} j={j} />)}</Rail>}
          {def.key === "organizations" && <Rail label="Training organizations">{view.organizations.map((o) => <OrgCard key={o.id} o={o} />)}</Rail>}
          {def.key === "trainees" && <Rail label="Trainees">{view.trainees.map((t) => <TraineeCard key={t.id} t={t} />)}</Rail>}
          {def.key === "events" && <Rail label="Events">{view.events.map((e) => <EventCard key={e.id} e={e} />)}</Rail>}
          {def.key === "videos" && <Rail label="Videos">{view.videos.map((v, i) => <VideoCard key={v.card.id} v={v} index={i} />)}</Rail>}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href={def.seeAll.href} className="inline-flex items-center gap-1 font-semibold text-brand-teal hover:underline">
              {def.seeAll.label} <Icon icon={ArrowRight} size="sm" />
            </Link>
            {hasSamples && (
              <p className="text-gray-600">
                These are examples. {def.invite.text}{" "}
                <Link href={def.invite.href} className="font-semibold text-brand-teal underline underline-offset-2 hover:no-underline">
                  {def.invite.label}
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
