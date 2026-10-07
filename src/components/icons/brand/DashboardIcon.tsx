import type { SVGProps } from "react";

/**
 * Custom brand icon. Dashboard: a main panel, a side stat and two small tiles. For every role's home page.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="11" height="10" rx="2" />
      <rect x="17" y="3" width="4" height="6" rx="1.5" />
      <rect x="17" y="12" width="4" height="9" rx="1.5" />
      <rect x="3" y="16" width="11" height="5" rx="2" />
      <path d="M6.5 9.5l2-2.2 2 1.4 1.5-2" />
    </svg>
  );
}
