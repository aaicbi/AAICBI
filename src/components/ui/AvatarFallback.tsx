import { User, Building2 } from "lucide-react";
import Icon from "./Icon";

/**
 * Replaces the 🙂 (person) / 🏢 (company) placeholder glyph duplicated
 * identically across 6 files. Existing call sites size it via text
 * classes (text-xl/text-2xl) meant for an emoji glyph — those become
 * icon `size` values at each call site, not a pure text-to-icon swap.
 */
export default function AvatarFallback({
  variant = "person",
  size = "md",
  className = "text-brand-teal",
}: {
  variant?: "person" | "company";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  return <Icon icon={variant === "company" ? Building2 : User} size={size} className={className} />;
}
