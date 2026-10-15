"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleHelp, Gamepad2, ListOrdered, Shuffle, Sparkles, Split, Star, Trophy, Zap, type LucideIcon } from "lucide-react";
import type { VisitorGame } from "@/lib/quest/visitorPlay";

const FORMATS: Record<string, { label: string; icon: LucideIcon; line: string }> = {
  QUIZ: { label: "Quiz", icon: CircleHelp, line: "Pick the right answer" },
  MATCHING: { label: "Match", icon: Shuffle, line: "Pair them up fast" },
  ORDERING: { label: "Order", icon: ListOrdered, line: "Put the steps in order" },
  SCENARIO: { label: "Scenario", icon: Split, line: "Make the call" },
};

/**
 * The feed's game advert. It is built like a shop-window banner on purpose: a bright moving background, a bold promise, a "Free" ribbon,
 * one big featured game with a pulsing Play now button, and the other formats a tap away. The featured game rotates by itself (paused
 * while a hand or focus is on it, and not at all for anyone who asks for less motion). Only true things are claimed: ten questions, about
 * two minutes, free. Everything that moves is a transform or opacity, and the global reduced-motion rule switches it off.
 */
export default function GameAdvert({ games, signedIn }: { games: VisitorGame[]; signedIn: boolean }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const still = useRef(false);

  useEffect(() => {
    still.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    if (games.length < 2) return;
    const t = setInterval(() => {
      if (!paused.current && !still.current) setI((n) => (n + 1) % games.length);
    }, 4200);
    return () => clearInterval(t);
  }, [games.length]);

  if (games.length === 0) return null;
  const g = games[Math.min(i, games.length - 1)];
  const f = FORMATS[g.format] ?? FORMATS.QUIZ;

  return (
    <section
      aria-label="Try a game"
      data-testid="try-games"
      className="ad-banner relative overflow-hidden rounded-3xl p-4 text-white shadow-lg"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <span className="ad-shine" aria-hidden="true" />
      <span className="ad-float absolute right-4 top-[112px] text-[#F2B84B]" aria-hidden="true"><Trophy className="h-7 w-7" /></span>
      <span className="ad-float absolute right-7 top-[70px] text-white/80" style={{ animationDelay: "-1.2s" }} aria-hidden="true"><Star className="h-4 w-4" /></span>
      <span className="ad-float absolute right-[88px] top-[128px] text-[#F2B84B]/90" style={{ animationDelay: "-2.1s" }} aria-hidden="true"><Zap className="h-4 w-4" /></span>
      <span className="ad-twinkle absolute right-16 top-[76px] text-white" aria-hidden="true"><Sparkles className="h-4 w-4" /></span>

      <div className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2B84B] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#2A1D00]">
          <span className="ad-dot h-2 w-2 rounded-full bg-[#2A1D00]" aria-hidden="true" /> Free to play
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white/90"><Gamepad2 className="h-4 w-4" aria-hidden="true" />{games.length} game{games.length === 1 ? "" : "s"}</span>
      </div>

      <h2 className="relative mt-3 font-display text-2xl font-extrabold leading-[1.08] tracking-tight">
        Think you<br />know it?<br />
        <span className="text-[#F2B84B]">Prove it.</span>
      </h2>
      <p className="relative mt-1 text-sm font-medium text-white/90">Beat the ten-question challenge.</p>

      <div key={g.id} className="ad-swap relative mt-3 rounded-2xl bg-white/12 p-3 ring-1 ring-white/25 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="ad-glow flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0A3F3A]"><f.icon className="h-6 w-6" aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#F2B84B]">{f.label} · {f.line}</span>
            <span className="block truncate text-base font-bold leading-tight">{g.moduleTitle}</span>
            <span className="block truncate text-xs text-white/85">{g.courseTitle}</span>
          </span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {["10 questions", "About 2 minutes", "Loop cheers you on"].map((t) => <li key={t} className="rounded-full bg-black/20 px-2 py-0.5">{t}</li>)}
        </ul>
        <Link
          href={`/play/${g.id}`}
          data-testid="try-game-link"
          className="ad-cta group relative mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-base font-extrabold text-[#0A3F3A] shadow-md transition-transform hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#F2B84B]"
        >
          Play now <ArrowRight className="ad-arrow h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      {games.length > 1 && (
        <div className="relative mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">More ways to play</p>
          <ul className="mt-1.5 grid grid-cols-4 gap-1.5">
            {games.map((x, n) => {
              const xf = FORMATS[x.format] ?? FORMATS.QUIZ;
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setI(n)}
                    aria-label={`${xf.label}: ${x.moduleTitle}`}
                    aria-pressed={n === i}
                    className={`flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2B84B] ${n === i ? "scale-105 bg-[#F2B84B] text-[#2A1D00]" : "bg-white/15 text-white hover:bg-white/25"}`}
                  >
                    <xf.icon className="h-4 w-4" aria-hidden="true" />
                    {xf.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="relative mt-3 text-center text-[11px] text-white/85">{signedIn ? "Your answers help the team improve the games." : "Sign in or create a free account to play."}</p>
    </section>
  );
}
