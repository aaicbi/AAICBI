import type { SVGProps } from "react";

/**
 * Custom brand icon. Settings: two sliders. For preferences and configuration.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h9M19 7h1" />
      <circle cx="16" cy="7" r="2.5" />
      <path d="M4 17h1M11 17h9" />
      <circle cx="8" cy="17" r="2.5" />
    </svg>
  );
}
