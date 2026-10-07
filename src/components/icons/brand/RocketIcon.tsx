import type { SVGProps } from "react";

/**
 * Custom brand icon. Rocket: for pitches and early-stage ventures.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function RocketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3c3.2 2 5 5.2 5 9l-2.5 3h-5L7 12c0-3.8 1.8-7 5-9z" />
      <circle cx="12" cy="9.5" r="1.6" />
      <path d="M9.5 15L8 19.5l4-1.5M14.5 15l1.5 4.5-4-1.5" />
    </svg>
  );
}
