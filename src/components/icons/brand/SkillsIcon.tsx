import type { SVGProps } from "react";

/**
 * Custom brand icon. Skills: a tag with a stack line. For the skills a program teaches.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, currentColor so it follows the theme.
 */
export default function SkillsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0l-6.7-6.7a2 2 0 0 1-.6-1.4Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  );
}
