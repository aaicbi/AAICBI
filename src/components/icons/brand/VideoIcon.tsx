import type { SVGProps } from "react";

/**
 * Custom brand icon. Video: a screen with a play mark. For education videos.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, currentColor so it follows the theme.
 */
export default function VideoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5v5l4.5-2.5-4.5-2.5Z" />
    </svg>
  );
}
