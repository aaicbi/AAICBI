import type { SVGProps } from "react";

/**
 * Custom brand icon. Assignments: a sheet with a pencil. Written work, distinct from timed assessments.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function AssignmentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
      <path d="M14 3l5 5v2" />
      <path d="M14 3v5h5" />
      <path d="M8.5 12h4M8.5 15.5h2" />
      <path d="M14.5 21l.8-3 5.2-5.2a1.4 1.4 0 0 1 2 2L17.3 20z" />
    </svg>
  );
}
