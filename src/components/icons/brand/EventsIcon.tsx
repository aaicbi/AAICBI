import type { SVGProps } from "react";

/**
 * Custom brand icon. Events: a calendar page with a marked day. For open days and workshops.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, currentColor so it follows the theme.
 */
export default function EventsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.5" />
    </svg>
  );
}
