"use client";
import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "@/components/games/experience/useReducedMotion";

const COLORS = ["bg-brand-teal", "bg-brand-gold", "bg-brand-rose", "bg-brand-green", "bg-brand-action"];

/**
 * A short burst of paper pieces for a real achievement, never for an ordinary answer. Plain CSS transforms, removed from the
 * page when finished, and skipped altogether when the device asks for less motion. `burst` goes up by one for each celebration.
 */
export default function Confetti({ burst, strength }: { burst: number; strength: "small" | "big" }) {
  const reduced = useReducedMotion();
  const [visibleBurst, setVisibleBurst] = useState(0);

  useEffect(() => {
    if (burst <= 0 || reduced) return;
    setVisibleBurst(burst);
    const timer = setTimeout(() => setVisibleBurst(0), 1700);
    return () => clearTimeout(timer);
  }, [burst, reduced]);

  const pieces = useMemo(() => {
    const n = strength === "big" ? 34 : 14;
    // Spread evenly with a little scatter; fixed per burst so a re-render does not reshuffle them mid-air.
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 + ((i * 37) % 11) * 0.05;
      const reach = (strength === "big" ? 150 : 100) + ((i * 53) % 60);
      return {
        dx: Math.round(Math.cos(angle) * reach),
        dy: Math.round(Math.sin(angle) * reach * 0.7 + 90 + ((i * 29) % 50)),
        rot: ((i * 47) % 360) - 180,
        delay: ((i * 13) % 8) * 0.02,
        color: COLORS[i % COLORS.length],
      };
    });
  }, [strength, visibleBurst]); // eslint-disable-line react-hooks/exhaustive-deps

  if (visibleBurst === 0 || reduced) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-testid="confetti">
      {pieces.map((p, i) => (
        <span key={`${visibleBurst}-${i}`} className={`gx-confetti-piece ${p.color}`} style={{ ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, ["--delay" as string]: `${p.delay}s` }} />
      ))}
    </div>
  );
}
