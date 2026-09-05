"use client";
import { useEffect, useRef, useState } from "react";

interface TimerProps {
  /** Seconds remaining as reported by the server at attempt start. */
  initialSecondsRemaining: number;
  /** When the client received initialSecondsRemaining (Date.now() at that moment). */
  clientStartedAt: number;
  onExpire: () => void;
}

const WARNING_THRESHOLDS = [600, 300, 60]; // 10 min, 5 min, 1 min

/**
 * The countdown here is cosmetic — it's derived once from the server's
 * `secondsRemaining` and then just ticks down locally with
 * setInterval(1000ms). It is NOT the source of truth for whether the
 * attempt has actually expired; that's `attempt.expiresAt` on the
 * server, re-checked on every /answers and /submit call (see
 * examEngine.ts). If this component drifts or the tab is backgrounded
 * and throttled, the worst case is the student sees a slightly stale
 * number for a few seconds — the server still rejects writes past
 * expiry regardless of what this shows.
 */
export default function Timer({ initialSecondsRemaining, clientStartedAt, onExpire }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSecondsRemaining);
  const warnedRef = useRef(new Set<number>());
  const expiredRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - clientStartedAt) / 1000);
      const remaining = Math.max(0, initialSecondsRemaining - elapsed);
      setSeconds(remaining);

      for (const threshold of WARNING_THRESHOLDS) {
        if (remaining <= threshold && !warnedRef.current.has(threshold)) {
          warnedRef.current.add(threshold);
        }
      }
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSecondsRemaining, clientStartedAt]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const low = seconds <= 300;
  const critical = seconds <= 60;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${
        critical
          ? "bg-red-50 text-red-600"
          : low
          ? "bg-amber-50 text-amber-700"
          : "bg-brand-mint text-brand-teal"
      }`}
    >
      <span aria-hidden>⏱</span>
      <span aria-live="polite">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
