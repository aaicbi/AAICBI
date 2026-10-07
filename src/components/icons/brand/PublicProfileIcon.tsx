import type { SVGProps } from "react";

/**
 * Custom brand icon. Public profile: a page with a person. For the organization's public page.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, currentColor so it follows the theme.
 */
export default function PublicProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M7.5 17c.8-2 2.4-3 4.5-3s3.7 1 4.5 3" />
    </svg>
  );
}
