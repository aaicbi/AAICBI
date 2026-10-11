"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const CLASS: Record<number, string> = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5", 6: "line-clamp-6", 8: "line-clamp-[8]", 10: "line-clamp-[10]" };

/**
 * Keeps long text inside its card: it shows the first few lines and a "See more" button, only when the text is really
 * longer than that. "See less" folds it back. Text always wraps (long words and addresses too), so it can never run out of
 * the card. Without JavaScript the text is simply cut at the line limit by CSS, never overflowing.
 */
export default function Clamp({ lines = 4, children, className = "", moreLabel = "See more", lessLabel = "See less" }: { lines?: 2 | 3 | 4 | 5 | 6 | 8 | 10; children: React.ReactNode; className?: string; moreLabel?: string; lessLabel?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  const measure = () => {
    const el = box.current;
    if (el && !open) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  };
  useLayoutEffect(measure); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`min-w-0 ${className}`}>
      <div ref={box} className={`break-words [overflow-wrap:anywhere] ${open ? "" : CLASS[lines]}`}>{children}</div>
      {(overflowing || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 inline-flex min-h-[32px] items-center text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}
