import { BADGE_LABELS, type BadgeKey } from "@/lib/ecosystem/visibilityCore";

/** Reputation badges. Verified is shown by VerifiedBadge, so it is skipped here. The numeric score is never rendered. */
export default function OrgBadges({ badges }: { badges: BadgeKey[] }) {
  const shown = badges.filter((b) => b !== "verified");
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Reputation badges">
      {shown.map((b) => (
        <li key={b} className="rounded-full bg-brand-mint px-2 py-0.5 text-xs font-medium text-brand-tealDeep">{BADGE_LABELS[b]}</li>
      ))}
    </ul>
  );
}
