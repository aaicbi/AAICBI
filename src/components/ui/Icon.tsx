import type { ComponentType, SVGProps } from "react";

/**
 * Icon system, foundation — the one place every icon in this app should
 * be imported through, whether it's a lucide-react icon or one of this
 * app's own custom brand icons (src/components/icons/brand/). Before
 * this, every icon was a raw emoji/Unicode glyph embedded directly in
 * JSX strings (153 occurrences across ~60 files, confirmed via a full
 * repo audit) — inconsistent sizing, no stroke-weight consistency, and
 * no accessible name for anything that mattered.
 *
 * Deliberately thin: lucide-react icons already accept standard SVG
 * props (width/height/strokeWidth/className) natively, so this isn't a
 * reimplementation — it's a standardized size scale plus the
 * accessibility handling every icon usage in this app needs to get
 * right (decorative vs. meaningful), applied once instead of decided
 * ad hoc at every call site.
 *
 * Works identically for a lucide icon and a custom brand icon because
 * every custom brand icon is authored to accept the same prop shape
 * (see src/components/icons/brand/README's convention, or any icon in
 * that folder) — both are just `ComponentType<SVGProps<SVGSVGElement>>`
 * as far as this component is concerned.
 */
export type IconSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 24, xl: 32 };

export interface IconProps {
  /** A lucide-react icon component, or a custom brand icon from src/components/icons/brand/. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** sm=16px, md=20px (default — matches the app's existing ad-hoc h-5 w-5 icons), lg=24px, xl=32px. */
  size?: IconSize;
  className?: string;
  /**
   * Set this ONLY when the icon itself is the sole carrier of meaning —
   * an icon-only button (delete, close, remove) with no visible text
   * label alongside it. When the icon sits next to its own text label
   * (a nav item, a section heading, a button with a text child), leave
   * this unset: the icon is decorative there and the adjacent text is
   * already the accessible name, so double-announcing it would be
   * noise, not help, for a screen reader.
   */
  label?: string;
  /** Matches lucide's own default and every ad-hoc SVG already in this app (SiteHeader, BackButton, NotificationBell). */
  strokeWidth?: number;
}

export default function Icon({ icon: IconComponent, size = "md", className, label, strokeWidth = 2 }: IconProps) {
  const px = SIZE_PX[size];
  const a11yProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const, focusable: false as const };

  return <IconComponent width={px} height={px} strokeWidth={strokeWidth} className={className} {...a11yProps} />;
}
