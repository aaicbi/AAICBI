import type { SVGProps } from "react";

/**
 * Custom brand icon. Messages: a speech bubble with two lines. For conversations and the inbox.
 * Drawn on the shared AAICBI grid: 24px box, 2px stroke, round caps and
 * joins, 2px minimum gap, currentColor so it follows the theme. Accepts
 * the same props as a lucide icon, so it works through ui/Icon.
 */
export default function MessagesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L8 20v-3.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  );
}
