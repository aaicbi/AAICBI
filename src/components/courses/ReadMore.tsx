"use client";
import { useState } from "react";

/** A paragraph kept to a few lines with a Read more toggle, so long descriptions never stretch a page. Short text shows no toggle. */
export default function ReadMore({ text, lines = 4, className = "" }: { text: string; lines?: 3 | 4 | 5 | 6; className?: string }) {
  const [open, setOpen] = useState(false);
  const clamp = { 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5", 6: "line-clamp-6" }[lines];
  const long = text.length > lines * 70;
  return (
    <div className={className}>
      <p className={`whitespace-pre-line break-words text-sm leading-relaxed text-gray-700 [overflow-wrap:anywhere] sm:text-base ${open ? "" : clamp}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
