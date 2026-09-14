import type { SVGProps } from "react";

/**
 * Custom brand icon, inline scale — the small companion to
 * AchievementDoodle (src/components/doodles/), which is deliberately
 * too large/decorative (hero/celebration scale, hardcoded gold hexes)
 * to sit next to text in a tab label or a Button. This one is
 * currentColor-based so it inherits color and adapts to dark mode
 * exactly like a lucide icon, and forwards every prop onto the root
 * <svg> so it renders identically through src/components/ui/Icon.tsx.
 * A medal-and-ribbon shape with a check, for certificate/achievement
 * moments (dashboard highlights, certificate-related section headers).
 */
export default function AchievementIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="5" />
      <path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" />
      <path d="M9.5 8l1.8 1.8L14.5 6" />
    </svg>
  );
}
