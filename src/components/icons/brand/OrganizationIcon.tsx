import type { SVGProps } from "react";

/**
 * Custom brand icon. Organization: a building with a pitched roof. For training organizations.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function OrganizationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M2.5 21h19" />
      <path d="M9 10h2M13 10h2M9 14h2M13 14h2" />
      <path d="M10.5 21v-3.5h3V21" />
    </svg>
  );
}
