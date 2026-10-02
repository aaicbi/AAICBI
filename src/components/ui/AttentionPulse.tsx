import type { ComponentType, SVGProps } from "react";
import Icon, { type IconSize } from "@/components/ui/Icon";

/**
 * The shared "notice me" primitive, used wherever something genuinely
 * new/actionable has just become available (a free preview, an exam
 * unlocking) and deserves a moment of visual attention — a slow
 * glow/dim pulse (see the `glow-pulse` keyframe in globals.css), not a
 * fast flash.
 *
 * Wraps the icon only, never the surrounding text — body copy stays
 * legible mid-pulse, and it keeps this restrained the same way this
 * app's design system already reserves gold for genuine achievement
 * rather than decorating everything. One shared component rather than
 * the same arbitrary Tailwind animation class copy-pasted at every
 * call site, so "where is this effect used" has one real answer.
 */
export default function AttentionPulse({
  icon,
  size = "sm",
  className = "",
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  size?: IconSize;
  className?: string;
}) {
  return <Icon icon={icon} size={size} className={`animate-[glow-pulse_2.5s_ease-in-out_infinite] ${className}`} />;
}
