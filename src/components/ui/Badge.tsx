/**
 * Small status pills — "PASS," "Locked," "Revoked," "Valid" — used
 * consistently instead of each page inventing its own colored-text
 * convention (some pages used font-semibold text-red-600, others
 * text-brand-teal, with no shared meaning between them).
 *
 * Audit finding, closed here: two separate dark-mode gaps in this one
 * small file. `warning` used a hardcoded hex — see `brand-gold-text`'s
 * own schema comment for why a dedicated token exists for exactly
 * this. `neutral` used Tailwind's own default gray scale
 * (`gray-100`/`gray-600`), not this app's theme-aware `brand-*`
 * tokens at all — those never respond to the `.dark` class the rest
 * of this app's colors do, so this variant would have silently stayed
 * a light badge on a dark page regardless of theme.
 */
type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "gold";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-brand-mint text-brand-tealDeep",
  warning: "bg-brand-goldLight text-brand-goldText",
  danger: "bg-brand-roseLight text-brand-rose",
  neutral: "bg-brand-gray/40 text-brand-ink",
  gold: "bg-brand-gold text-white",
};

export default function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
