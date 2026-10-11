import Link from "next/link";
import Card from "@/components/ui/Card";
import AvatarFallback from "@/components/ui/AvatarFallback";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";
import type { ProfileHit } from "@/lib/profiles/profileSearch";

/** A person, organization, employer, investor or startup in the search results: who it is, what it does, where, and the way to its page. */
export default function ProfileHitCard({ hit }: { hit: ProfileHit }) {
  const round = hit.kind === "PERSON" || hit.kind === "STAFF";
  return (
    <Link href={`/@${hit.handle}`} className="block">
      <Card interactive className="flex h-full items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-brand-surface ${round ? "rounded-full" : "rounded-xl"}`}>
          {hit.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={hit.avatarUrl} alt="" className="no-ring h-full w-full object-cover" /> : <AvatarFallback variant={round ? "person" : "company"} size="md" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="truncate font-display font-semibold text-brand-ink">{hit.name}</span>
            {hit.verified && <VerifiedBadge />}
          </span>
          <span className="block truncate text-xs text-gray-700">@{hit.handle} · {hit.kindLabel}{hit.location ? ` · ${hit.location}` : ""}</span>
          {hit.formerHandle && <span className="block truncate text-xs text-brand-goldText">Formerly @{hit.formerHandle}</span>}
          {hit.headline && <span className="mt-1 line-clamp-2 block text-sm text-gray-800">{hit.headline}</span>}
          {(hit.skills.length > 0 || hit.chips.length > 0) && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {[...hit.chips, ...hit.skills].slice(0, 5).map((c) => <span key={c} className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-semibold text-gray-800">{c}</span>)}
            </span>
          )}
          <span className="mt-2 block text-sm font-semibold text-brand-teal">View profile</span>
        </span>
      </Card>
    </Link>
  );
}
