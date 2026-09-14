import type { SVGProps } from "react";

/**
 * Custom brand icon — for "Loop," this app's own named AI Command
 * Center feature (src/lib/loop/tools.ts, /admin/command). A generic
 * "bot" or "sparkles" icon reads as AI-in-general; this is meant to
 * read as *this app's* AI specifically — a continuous loop (Loop
 * iterates/watches, not a one-shot query) with a small spark at its
 * center standing in for the "AI" part.
 */
export default function LoopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12a8 8 0 0 1 14-5" />
      <path d="M18 3v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5" />
      <path d="M6 21v-4h4" />
      <path d="M12 10.5v3" />
      <path d="M10.5 12h3" />
    </svg>
  );
}
