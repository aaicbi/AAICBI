import type { SVGProps } from "react";

/**
 * Custom brand icon. Insights: three rising bars and a marker. For performance, analytics and progress.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function InsightsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 20v-6M11 20V9M17 20V12" />
      <path d="M3 20h18" />
      <circle cx="17" cy="6" r="2" />
      <path d="M11 6.2l3.6-.2" />
    </svg>
  );
}
