import Link from "next/link";
import Badge from "@/components/ui/Badge";
import AvatarFallback from "@/components/ui/AvatarFallback";

type StatusVariant = "success" | "warning" | "danger" | "neutral" | "gold";

/**
 * Personalized landing page — the shared identity strip at the top of
 * every role's dashboard. Deliberately its own small component (not
 * copy-pasted three times) so the three dashboards can't silently
 * drift apart, and so this one piece can be removed or changed without
 * touching the rest of any dashboard page.
 *
 * Every prop is pre-computed by the calling page from real data — this
 * component renders, it doesn't decide. Nothing here is invented: the
 * status/role/last-visit strings all come from actual database fields
 * (see each dashboard page's own comment on where its values come
 * from).
 */
export default function WelcomeHeader({
  greeting,
  name,
  avatarUrl,
  username,
  roleLabel,
  statusLabel,
  statusVariant,
  lastVisitLabel,
  momentumLine,
  profileHref,
}: {
  greeting: string;
  name: string;
  avatarUrl: string | null;
  username?: string | null;
  roleLabel: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  lastVisitLabel: string | null;
  momentumLine?: string | null;
  profileHref: string;
}) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <Link href={profileHref} className="shrink-0" aria-label="View your profile">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-brand-mint transition-opacity hover:opacity-80">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <AvatarFallback size="md" />
              </div>
            )}
          </div>
        </Link>
        <div>
          <p className="text-sm font-medium text-brand-teal">{greeting}</p>
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-brand-ink sm:text-3xl">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {username && <span>@{username}</span>}
            <span>{roleLabel}</span>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
          {momentumLine && <p className="mt-1.5 text-sm text-gray-600">{momentumLine}</p>}
        </div>
      </div>
      <div className="text-left text-xs text-gray-400 sm:text-right">
        <p>{today}</p>
        {lastVisitLabel && <p className="mt-0.5">Last visit: {lastVisitLabel}</p>}
      </div>
    </div>
  );
}
