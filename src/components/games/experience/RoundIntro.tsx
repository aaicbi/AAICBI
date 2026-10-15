"use client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import LoopFace from "@/components/guide/LoopFace";
import { useReducedMotion } from "@/components/games/experience/useReducedMotion";

/**
 * The start of a round: a welcome from Loop, then (the first round of a visit only) a short 3, 2, 1, GO. It is skippable, short
 * on purpose, and nothing is asked of the server until it ends, so the countdown never eats into the learner's thinking time.
 */
export default function RoundIntro({ title, size, roundNo, welcome, countdown, onStart, onReady }: { title: string; size: number; roundNo: number; welcome: string; countdown: boolean; onStart: () => void; onReady: () => void }) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState<number | null>(null); // 3, 2, 1, then 0 = GO

  useEffect(() => {
    if (count === null) return;
    const wait = reduced ? 450 : count === 0 ? 550 : 750;
    const timer = setTimeout(() => (count > 0 ? setCount(count - 1) : onReady()), wait);
    return () => clearTimeout(timer);
  }, [count, onReady, reduced]);

  function start() {
    onStart();
    if (countdown) setCount(3);
    else onReady();
  }

  if (count !== null) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center" data-testid="countdown">
        <p key={count} className="gx-go bg-gradient-to-br from-brand-gold via-brand-rose to-brand-teal bg-clip-text text-8xl font-extrabold text-transparent" role="status" aria-live="assertive">
          {count === 0 ? "GO!" : count}
        </p>
        <Button variant="ghost" size="sm" onClick={onReady}>
          Skip
        </Button>
      </div>
    );
  }

  return (
    <div className="gx-rise flex flex-col items-center gap-4 py-4 text-center" data-testid="round-intro">
      <span className="eco-hub relative inline-flex rounded-full"><LoopFace state="attention" size={96} /></span>
      <div>
        <p className="inline-block rounded-full bg-[#F2B84B] px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-[#2A1D00]">{roundNo > 1 ? `Round ${roundNo}` : "Ready?"}</p>
        <h2 className="mt-2 bg-gradient-to-r from-brand-tealDeep via-brand-teal to-brand-gold bg-clip-text font-display text-2xl font-extrabold text-transparent">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-gray-700" data-testid="welcome-message">
          {welcome}
        </p>
        <p className="mt-1 text-xs text-gray-600">{size} questions. Take your time: this is practice.</p>
      </div>
      <Button onClick={start} data-testid="round-start" autoFocus size="lg" className="gx-pulse min-h-[52px] px-10 text-base font-extrabold">
        {roundNo > 1 ? "Start round" : "Let's go"}
      </Button>
    </div>
  );
}
