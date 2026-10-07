import type { SVGProps } from "react";

/**
 * Custom brand icon. Showcase: a star with a spark. For community projects and highlights.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function ShowcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.8l5-.7z" />
      <path d="M19.5 3v3M18 4.5h3" />
    </svg>
  );
}
