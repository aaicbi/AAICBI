"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, Building2, GraduationCap, Landmark, Sparkles, type LucideIcon } from "lucide-react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import type { LandingStats } from "@/lib/landing/types";

/**
 * The landing page hero: a short promise, the ecosystem drawn as a map
 * the visitor can explore, and direct entry points. Selecting a part of
 * the ecosystem explains what it does and links to where to go. It is a
 * tab list, so it works with a keyboard (arrow keys move between parts)
 * and is announced properly by screen readers. Counts shown here are real
 * and only shown when above zero.
 */

type NodeKey = "trainees" | "organizations" | "employers" | "opportunities" | "investors";

interface Node {
  key: NodeKey;
  label: string;
  icon: LucideIcon;
  short: string;
  /** Positions on the map from the small breakpoint up. */
  place: string;
  detail: string;
}

const NODES: Node[] = [
  { key: "trainees", label: "Trainees", icon: GraduationCap, short: "Learn and build", place: "sm:left-[1%] sm:top-[40%]", detail: "Learn through structured programs, build projects, and earn certificates anyone can verify. Choose to be seen, and employers and organizations can find you." },
  { key: "organizations", label: "Training organizations", icon: Building2, short: "Train and share", place: "sm:left-[34%] sm:top-[2%]", detail: "Run programs on the platform, publish what your trainees build, announce events, and be discovered by people looking for training." },
  { key: "employers", label: "Employers", icon: Briefcase, short: "Find talent", place: "sm:left-[67%] sm:top-[40%]", detail: "Post roles and find people whose skills are backed by verified certificates and real projects. Contact details are shared only when a trainee agrees." },
  { key: "opportunities", label: "Opportunities", icon: Sparkles, short: "Jobs, programs, events", place: "sm:left-[34%] sm:top-[78%]", detail: "Open roles, training programs and events in one place, so the next step is never far from what someone just learned." },
  { key: "investors", label: "Investors", icon: Landmark, short: "Back what grows", place: "sm:left-[68%] sm:top-[8%] sm:w-[30%]", detail: "Discover training organizations by the skills they teach, and follow the pitches that trainees choose to share." },
];

export interface HeroLinks {
  courses: boolean;
  jobs: boolean;
  organizations: boolean;
  trainees: boolean;
  events: boolean;
}

function actions(key: NodeKey, on: HeroLinks): Array<{ label: string; href: string }> {
  switch (key) {
    case "trainees":
      return [
        { label: "Find training", href: "/courses" },
        ...(on.trainees ? [{ label: "Explore trainees", href: "/trainees" }] : []),
        { label: "Create a trainee account", href: "/trainee/register" },
      ];
    case "organizations":
      return [
        ...(on.organizations ? [{ label: "Meet organizations", href: "/organizations" }] : []),
        { label: "Register your organization", href: "/org/register" },
      ];
    case "employers":
      return [
        ...(on.trainees ? [{ label: "Explore trainees", href: "/trainees" }] : []),
        { label: "Register as an employer", href: "/employer/register" },
        { label: "Employer sign in", href: "/employer/login" },
      ];
    case "opportunities":
      return [
        ...(on.jobs ? [{ label: "Discover opportunities", href: "/jobs" }] : []),
        { label: "Find training", href: "/courses" },
        ...(on.events ? [{ label: "See events", href: "/events" }] : []),
      ];
    default:
      return [
        ...(on.organizations ? [{ label: "Explore organizations", href: "/organizations" }] : []),
        { label: "Register as an investor", href: "/investor/register" },
      ];
  }
}

export default function EcosystemHero({ stats, links }: { stats: LandingStats; links: HeroLinks }) {
  const [active, setActive] = useState<NodeKey>("trainees");
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const node = NODES.find((n) => n.key === active)!;

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const move = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!move && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? NODES.length - 1 : (index + move + NODES.length) % NODES.length;
    setActive(NODES[next].key);
    tabs.current[NODES[next].key]?.focus();
  }

  const counts = [
    { n: stats.organizations, one: "training organization", many: "training organizations" },
    { n: stats.programs, one: "program", many: "programs" },
    { n: stats.jobs, one: "open opportunity", many: "open opportunities" },
    { n: stats.trainees, one: "public trainee profile", many: "public trainee profiles" },
  ].filter((c) => c.n > 0);

  return (
    <section aria-labelledby="hero-heading" className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 lg:grid-cols-[1fr_1.1fr] lg:py-20">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-teal">Africa&apos;s AI Capacity Building Initiative</span>
        <h1 id="hero-heading" className="mt-4 font-display text-4xl font-semibold leading-tight text-brand-ink sm:text-5xl">
          Learn. Connect. Build. Find your opportunity.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600">
          A place where people learn, organizations train, employers discover talent, and opportunities find the people ready for them.
          Look around first; you only need an account when you want to act.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button href="#ecosystem" size="lg">
            Explore the ecosystem
          </Button>
          <Button href="#join" variant="secondary" size="lg">
            Join the platform
          </Button>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          {[
            { label: "Find training", href: "/courses", show: true },
            { label: "Discover opportunities", href: "/jobs", show: links.jobs },
            { label: "Meet organizations", href: "/organizations", show: links.organizations },
            { label: "Explore trainees", href: "/trainees", show: links.trainees },
          ]
            .filter((l) => l.show)
            .map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex items-center gap-1 text-brand-teal hover:underline">
                  {l.label} <Icon icon={ArrowRight} size="sm" />
                </Link>
              </li>
            ))}
        </ul>
        {counts.length > 0 && (
          <p className="mt-6 text-sm text-gray-600">
            Right now:{" "}
            {counts.map((c, i) => (
              <span key={c.many}>
                <strong className="font-semibold text-brand-ink">{c.n}</strong> {c.n === 1 ? c.one : c.many}
                {i < counts.length - 1 ? ", " : ""}
              </span>
            ))}
            .
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-brand-gray bg-brand-surface p-4 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-600">How the ecosystem fits together</h2>
        <div className="relative mt-4 grid grid-cols-2 gap-3 sm:block sm:aspect-[5/4] sm:gap-0">
          {/* connectors, drawn behind the parts */}
          <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" aria-hidden="true">
            <g fill="none" stroke="#85C79A" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" style={{ animation: "dash-flow 2.4s linear infinite" }} vectorEffect="non-scaling-stroke">
              <path d="M18 34 Q 26 18 44 12" vectorEffect="non-scaling-stroke" />
              <path d="M56 12 Q 74 18 82 34" vectorEffect="non-scaling-stroke" />
              <path d="M82 46 Q 74 62 56 66" vectorEffect="non-scaling-stroke" />
              <path d="M44 66 Q 26 62 18 46" vectorEffect="non-scaling-stroke" />
              <path d="M70 14 Q 62 12 56 12" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-brand-teal sm:flex" aria-hidden="true">
            <svg viewBox="0 0 40 40" className="h-10 w-10">
              <path d="M20 9 L31.5 15 L20 21 L8.5 15 Z" fill="#FFFFFF" />
              <path d="M14 17.3 V23.5 C14 25.7 16.7 27.5 20 27.5 C23.3 27.5 26 25.7 26 23.5 V17.3" stroke="#85C79A" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div role="tablist" aria-label="Parts of the ecosystem" className="contents">
            {NODES.map((n, i) => {
              const selected = n.key === active;
              return (
                <button
                  key={n.key}
                  ref={(el) => {
                    tabs.current[n.key] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`eco-tab-${n.key}`}
                  aria-selected={selected}
                  aria-controls="eco-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(n.key)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`${n.place} flex min-h-[64px] items-center gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal sm:absolute ${n.place.includes("sm:w-") ? "" : "sm:w-[32%]"} ${
                    selected ? "border-brand-teal bg-brand-mint" : "border-brand-gray bg-brand-surface hover:border-brand-teal"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-brand-teal text-brand-onAccent" : "bg-brand-mint text-brand-teal"}`}>
                    <Icon icon={n.icon} size="md" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight text-brand-ink">{n.label}</span>
                    <span className="mt-0.5 block text-xs leading-tight text-gray-600">{n.short}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div id="eco-panel" role="tabpanel" aria-labelledby={`eco-tab-${active}`} tabIndex={0} className="mt-4 rounded-xl bg-brand-sand/60 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
          <p className="font-display text-base font-semibold text-brand-ink">{node.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{node.detail}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            {actions(active, links).map((a) => (
              <li key={a.href + a.label}>
                <Link href={a.href} className="inline-flex items-center gap-1 text-brand-teal hover:underline">
                  {a.label} <Icon icon={ArrowRight} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
