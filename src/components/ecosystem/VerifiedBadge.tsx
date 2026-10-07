import { BadgeCheck } from "lucide-react";
import Icon from "@/components/ui/Icon";

/** "Verified Training Organization" — only ever rendered for an organization SUPER_ADMIN has verified. */
export default function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-teal">
      <Icon icon={BadgeCheck} size="sm" label={compact ? "Verified" : undefined} />
      {!compact && "Verified Training Organization"}
    </span>
  );
}
