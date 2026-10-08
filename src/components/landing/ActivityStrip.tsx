import Link from "next/link";
import { BookOpen, Briefcase, Building2, CalendarDays, PlayCircle } from "lucide-react";
import Icon from "@/components/ui/Icon";
import SampleTag from "@/components/landing/SampleTag";
import { timeAgo } from "@/lib/landing/core";
import type { ActivityItem, ActivityKind, SkillTrend } from "@/lib/landing/types";

const ICON: Record<ActivityKind, typeof BookOpen> = { program: BookOpen, job: Briefcase, organization: Building2, video: PlayCircle, event: CalendarDays };
const KIND_LABEL: Record<ActivityKind, string> = { program: "Program", job: "Opportunity", organization: "Organization", video: "Video", event: "Event" };

/**
 * "What's happening": the latest real activity across the ecosystem,
 * newest first. While there is little real activity, labelled examples
 * show what this will look like; they are visibly dashed and tagged, and
 * a line under the list says so. Trending skills are real counts only
 * and the row is hidden when there are none.
 */
export default function ActivityStrip({ items, skills, searchable }: { items: ActivityItem[]; skills: SkillTrend[]; searchable: boolean }) {
  if (items.length === 0 && skills.length === 0) return null;
  const hasSamples = items.some((i) => i.isSample);
  return (
    <section aria-labelledby="activity-heading" className="border-t border-brand-gray bg-brand-sand/50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 id="activity-heading" className="font-display text-2xl font-semibold text-brand-ink">
          What&apos;s happening in the ecosystem
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">New programs, opportunities, organizations, videos and events, as they appear.</p>

        {items.length > 0 && (
          <div role="region" aria-label="Recent activity" tabIndex={0} className="-mx-6 mt-6 snap-x scroll-px-6 overflow-x-auto px-6 pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal sm:mx-0 sm:scroll-px-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <ul className="flex gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => {
                const Ico = ICON[item.kind];
                return (
                  <li key={item.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                    <Link
                      href={item.href}
                      className={`flex h-full flex-col rounded-xl border bg-brand-surface p-4 transition-colors hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${item.isSample ? "border-dashed border-gray-400" : "border-brand-gray"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-teal">
                          <Icon icon={Ico} size="sm" /> {KIND_LABEL[item.kind]}
                        </span>
                        {item.isSample && <SampleTag />}
                      </span>
                      <span className="mt-2 text-sm leading-snug text-brand-ink">{item.text}</span>
                      {item.at && !item.isSample && <span className="mt-auto pt-3 text-xs text-gray-600">{timeAgo(item.at)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {hasSamples && (
          <p className="mt-3 text-xs text-gray-600">
            Examples show what this will look like. Real activity replaces them as organizations, trainees and employers add content.
          </p>
        )}

        {skills.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-brand-ink">Trending skills</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {skills.map((s) => (
                <li key={s.name}>
                  {searchable ? (
                    <Link href={`/search?q=${encodeURIComponent(s.name)}`} className="inline-flex rounded-full border border-brand-gray bg-brand-surface px-3 py-1 text-sm text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                      {s.name}
                    </Link>
                  ) : (
                    <span className="inline-flex rounded-full border border-brand-gray bg-brand-surface px-3 py-1 text-sm text-brand-ink">{s.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
