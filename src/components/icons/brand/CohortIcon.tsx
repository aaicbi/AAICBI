import type { SVGProps } from "react";

/**
 * Custom brand icon — for cohorts/intakes and community features.
 * Three connected nodes rather than lucide's generic two-person
 * "Users" glyph, reading more like a group/network (a cohort is a
 * connected batch, not just "some people") — used for cohort
 * management and community-facing section headers.
 */
export default function CohortIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 9.5 10.5 15" />
      <path d="M15 9.5 13.5 15" />
      <path d="M9.5 8h5" />
      <circle cx="7" cy="8" r="2.5" />
      <circle cx="17" cy="8" r="2.5" />
      <circle cx="12" cy="17" r="2.5" />
    </svg>
  );
}
