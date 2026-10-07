"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { COMPONENTS, COMPONENT_LABELS, BADGE_LABELS, type BadgeKey, type Component } from "@/lib/ecosystem/visibilityCore";

interface Insights {
  days: number;
  totals: { profileViews: number; videoViews: number; programClicks: number; newFollowers: number; likesAndSaves: number; newEnrollments: number };
  funnel: { viewsToClicks: number | null };
  topVideos: Array<{ id: string; title: string; thumbnailUrl: string; views: number; totalViews: number; reactions: number }>;
  topPrograms: Array<{ courseId: string; title: string; clicks: number }>;
  visibility: { badges: BadgeKey[]; components: Record<Component, number>; tips: Array<{ component: Component; label: string; tip: string }> } | null;
}

const TILES: Array<[keyof Insights["totals"], string]> = [
  ["profileViews", "Page visits"], ["videoViews", "Video views"], ["programClicks", "Program clicks"],
  ["newFollowers", "New followers"], ["likesAndSaves", "Likes and saves"], ["newEnrollments", "New enrollments"],
];

export default function OrgInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState(false);
  function load() {
    setError(false);
    fetch("/api/org/insights").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setError(true));
  }
  useEffect(load, []);
  if (error) return <ErrorState message="Could not load your numbers." onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;
  const { totals } = data;

  return (
    <div className="space-y-8">
      <section aria-labelledby="totals">
        <h2 id="totals" className="font-display text-lg font-semibold text-brand-ink">Last {data.days} days</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TILES.map(([key, label]) => (
            <Card key={key}><p className="text-2xl font-semibold text-brand-ink">{totals[key]}</p><p className="text-sm text-gray-600">{label}</p></Card>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {data.funnel.viewsToClicks === null ? "No visits yet, so there is no click rate to show." : `${data.funnel.viewsToClicks}% of visits and video views led to a click on one of your programs.`}
          {" "}Enrollments count everyone who joined your programs, from any source.
        </p>
      </section>

      <section aria-labelledby="top">
        <h2 id="top" className="font-display text-lg font-semibold text-brand-ink">Top videos</h2>
        <div className="mt-3 space-y-2">
          {data.topVideos.length === 0 && <EmptyState title="No published videos yet" description="Published trainee videos and their views show up here." />}
          {data.topVideos.map((v) => (
            <Card key={v.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail. */}
              <img src={v.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
              <p className="min-w-0 flex-1 truncate font-semibold text-brand-ink">{v.title}</p>
              <p className="shrink-0 text-xs text-gray-600">{v.views} views ({data.days} days) · {v.totalViews} total · {v.reactions} likes and saves</p>
            </Card>
          ))}
        </div>
        {data.topPrograms.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold text-brand-ink">Programs people clicked</h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {data.topPrograms.map((p) => <li key={p.courseId}>{p.title}: {p.clicks} click{p.clicks === 1 ? "" : "s"}</li>)}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="vis">
        <h2 id="vis" className="font-display text-lg font-semibold text-brand-ink">Your visibility</h2>
        {!data.visibility ? (
          <p className="mt-2 text-sm text-gray-600">Turn on your public page to be rated and shown to visitors.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-gray-600">
              {data.visibility.badges.length > 0 ? `Badges: ${data.visibility.badges.map((b) => BADGE_LABELS[b]).join(", ")}.` : "No badges yet."} Visibility rewards steady, complete, well-tagged videos, not the number of posts.
            </p>
            <Card className="space-y-2">
              {COMPONENTS.map((c) => (
                <div key={c}>
                  <div className="flex justify-between text-xs text-gray-600"><span>{COMPONENT_LABELS[c]}</span><span>{Math.round(data.visibility!.components[c] * 100)}%</span></div>
                  <div className="h-2 rounded-full bg-brand-gray/40" role="presentation"><div className="h-2 rounded-full bg-brand-teal" style={{ width: `${Math.round(data.visibility!.components[c] * 100)}%` }} /></div>
                </div>
              ))}
            </Card>
            {data.visibility.tips.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-brand-ink">What would help most</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {data.visibility.tips.map((t) => <li key={t.component}><strong>{t.label}:</strong> {t.tip}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
