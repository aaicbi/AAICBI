import type { SVGProps } from "react";

/**
 * Custom brand icon — for courses/learning paths. Deliberately echoes
 * GrowthPathDoodle's (src/components/doodles/) existing winding-path
 * motif at icon scale rather than inventing a second, competing visual
 * idea for the same concept — a winding route from a starting point to
 * a destination, standing in for a structured learning journey.
 */
export default function LearningPathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 19c3 0 2-5 5-5s2 5 5 5 2-6 5-6" />
      <circle cx="4" cy="19" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
