"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, Building2, GraduationCap, Landmark, Sparkles, type LucideIcon } from "lucide-react";

interface Part {
  key: string;
  label: string;
  icon: LucideIcon;
  text: string;
  cta: { label: string; href: string } | null;
  /** Position on the ring, in degrees from the top. */
  deg: number;
}

export interface EcosystemLinks {
  jobs: boolean;
  organizations: boolean;
  trainees: boolean;
}

/**
 * "How AAICBI fits together" for the feed's right-hand side: five parts around a glowing hub, a dashed ring that flows, a spark that orbits,
 * and the highlighted part moving on by itself every few seconds with a plain sentence about what it does. Hovering, focusing or tapping a
 * part takes over and stops the tour. Under reduced motion nothing moves by itself. Only links to pages that are switched on are offered.
 */
export default function FeedEcosystem({ links, signedIn }: { links: EcosystemLinks; signedIn: boolean }) {
  const parts: Part[] = [
    { key: "trainees", label: "Trainees", icon: GraduationCap, deg: 0, text: "Learn through programs, build projects and earn certificates anyone can verify.", cta: { label: "Find training", href: "/courses" } },
    { key: "organizations", label: "Training organizations", icon: Building2, deg: 72, text: "Teach on the platform, share what your trainees build and be found by people who want training.", cta: links.organizations ? { label: "Meet organizations", href: "/organizations" } : null },
    { key: "opportunities", label: "Opportunities", icon: Sparkles, deg: 144, text: "Jobs, programs and events in one place, so the next step is never far from what you just learned.", cta: links.jobs ? { label: "Discover opportunities", href: "/jobs" } : null },
    { key: "employers", label: "Employers", icon: Briefcase, deg: 216, text: "Find people whose skills are backed by verified certificates and real projects.", cta: links.trainees ? { label: "Explore trainees", href: "/trainees" } : null },
    { key: "investors", label: "Investors", icon: Landmark, deg: 288, text: "Discover training organizations and the startups that trainees choose to share.", cta: { label: "Explore startups", href: "/startups" } },
  ];
  const [active, setActive] = useState(0);
  const touring = useRef(true);
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const t = setInterval(() => {
      if (touring.current && !still.current) setActive((n) => (n + 1) % parts.length);
    }, 3600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const take = (n: number) => {
    touring.current = false;
    setActive(n);
  };
  const p = parts[active];
  const at = (deg: number, r: number) => ({ left: `${50 + r * Math.sin((deg * Math.PI) / 180)}%`, top: `${50 - r * Math.cos((deg * Math.PI) / 180)}%` });

  return (
    <section aria-label="How AAICBI fits together" data-testid="feed-ecosystem" className="eco-card relative overflow-hidden rounded-3xl border border-brand-gray p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-brand-teal">How AAICBI fits together</h2>
      <p className="mt-0.5 text-sm font-semibold text-brand-ink">One place where learning leads to opportunity.</p>

      <div className="relative mx-auto mt-3 aspect-square w-full max-w-[250px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="36" fill="none" stroke="#85C79A" strokeWidth="1.2" strokeDasharray="3 3" strokeLinecap="round" style={{ animation: "dash-flow 2.4s linear infinite" }} />
          <circle cx="50" cy="50" r="22" fill="none" stroke="#85C79A" strokeOpacity="0.35" strokeWidth="0.8" />
        </svg>
        <span className="eco-orbit absolute inset-0" aria-hidden="true"><span className="absolute left-1/2 top-[14%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#F2B84B] shadow-[0_0_12px_3px_rgba(242,184,75,0.8)]" /></span>
        <span className="eco-hub absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-brand-action" aria-hidden="true">
          <svg viewBox="0 0 40 40" className="h-9 w-9"><path d="M20 9 L31.5 15 L20 21 L8.5 15 Z" fill="#FFFFFF" /><path d="M14 17.3 V23.5 C14 25.7 16.7 27.5 20 27.5 C23.3 27.5 26 25.7 26 23.5 V17.3" stroke="#85C79A" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        </span>
        {parts.map((x, n) => {
          const on = n === active;
          return (
            <button
              key={x.key}
              type="button"
              aria-label={x.label}
              aria-pressed={on}
              onClick={() => take(n)}
              onMouseEnter={() => take(n)}
              onFocus={() => take(n)}
              style={at(x.deg, 36)}
              className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${on ? "eco-pulse scale-110 border-brand-teal bg-brand-action text-brand-onAccent" : "border-brand-gray bg-brand-surface text-brand-teal hover:border-brand-teal"}`}
            >
              <x.icon className="h-5 w-5" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div key={p.key} className="eco-swap mt-3 min-h-[116px] rounded-2xl bg-brand-mint/70 p-3" data-testid="feed-ecosystem-detail">
        <p className="font-display text-base font-semibold text-brand-ink">{p.label}</p>
        <p className="mt-1 text-sm leading-snug text-brand-ink">{p.text}</p>
        {p.cta && (
          <Link href={p.cta.href} className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-brand-teal hover:underline">
            {p.cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {!signedIn && (
        <Link href="/join" className="mt-3 flex min-h-[44px] items-center justify-center rounded-full bg-brand-action px-4 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover">
          Join the platform
        </Link>
      )}
      <Link href="/about" className="mt-2 block text-center text-xs font-semibold text-brand-teal hover:underline">See the whole picture</Link>
    </section>
  );
}
