"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/games/experience/useReducedMotion";

/** A number that counts up to its new value, so a gain is noticed. Shows the true value at once for reduced motion. */
export default function AnimatedNumber({ value, className = "" }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || value <= from.current) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 450);
      setShown(Math.round(begin + (value - begin) * t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, reduced]);

  return (
    <span key={value} className={`inline-block ${value > 0 ? "gx-count" : ""} ${className}`} data-value={value}>
      {shown}
    </span>
  );
}
