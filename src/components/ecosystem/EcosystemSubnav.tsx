import Link from "next/link";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";

const LINKS = [
  { href: "/feed", label: "Feed", key: "feed" },
  { href: "/learn", label: "Learn", key: "learn" },
  { href: "/organizations", label: "Organizations", key: "organizations" },
  { href: "/events", label: "Events", key: "events" },
  { href: "/jobs", label: "Opportunities", key: "jobs" },
  { href: "/trainees", label: "Trainees", key: "trainees" },
  { href: "/search", label: "Search", key: "search" },
] as const;

/**
 * Section switcher shared by the public ecosystem pages. A sticky strip
 * under the site header rather than a fixed bottom bar, so it never
 * competes with the cookie banner and help button that already own the
 * bottom edge on phones.
 */
export default async function EcosystemSubnav({ active, feedEnabled }: { active: "feed" | "learn" | "organizations" | "events" | "jobs" | "trainees" | "search"; feedEnabled: boolean }) {
  const flags = await getEcosystemFlags();
  const hidden = new Set<string>([...(feedEnabled ? [] : ["feed"]), ...(flags.publicJobs ? [] : ["jobs"]), ...(flags.publicTrainees ? [] : ["trainees"])]);
  return (
    <nav aria-label="Discover" className="sticky top-0 z-20 border-b border-brand-gray bg-brand-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {LINKS.filter((l) => !hidden.has(l.key)).map((l) => (
          <Link
            key={l.key}
            href={l.href}
            aria-current={active === l.key ? "page" : undefined}
            className={`whitespace-nowrap px-4 py-3 text-sm font-semibold ${active === l.key ? "border-b-2 border-brand-teal text-brand-teal" : "text-gray-600 hover:text-brand-ink"}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
