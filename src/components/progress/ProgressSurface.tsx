import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import type { ProgressSurfaceData, TopicCount } from "@/lib/trainee/progressSurface";

/**
 * "My Progress": the one screen that shows what only AAICBI can: the AI
 * feedback from every assessment pulled together, in the context of the
 * courses it came from, ending in a single suggested next step. Used by
 * the trainee's own page with live data, and by the landing page with a
 * clearly labelled sample. Presentational only, so it renders on the
 * server and needs no JavaScript.
 */
export default function ProgressSurface({ data, sample = false }: { data: ProgressSurfaceData; sample?: boolean }) {
  const { readiness, strengths, focus, latestNote, courses, nextStep } = data;
  const delta = readiness.scoreDelta;

  return (
    <div className="space-y-4">
      {sample && (
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Example with sample data, not a real trainee</p>
      )}

      <section aria-label="Readiness" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Recent average" value={readiness.averageScore === null ? "No scores yet" : `${readiness.averageScore}%`} note="Last five assessments" />
        <Tile
          label="Latest score"
          value={readiness.latestScore === null ? "None yet" : `${readiness.latestScore}%`}
          note={
            delta === null ? (
              "Compared once you have two"
            ) : (
              <span className="inline-flex items-center gap-1">
                <Icon icon={delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus} size="sm" />
                {delta === 0 ? "Same as before" : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} points on your earlier average`}
              </span>
            )
          }
        />
        <Tile label="Assessments analysed" value={String(readiness.attemptsAnalysed)} note="Each gets an AI review" />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-base font-semibold text-brand-ink">Where you are strong</h2>
          <TopicList items={strengths} empty="Your strengths show up after your first reviewed assessment." tone="strong" />
        </Card>
        <Card>
          <h2 className="font-display text-base font-semibold text-brand-ink">Focus next</h2>
          <TopicList items={focus} empty="No gaps flagged yet." tone="focus" />
        </Card>
      </div>

      {latestNote && (
        <Card variant="highlighted">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              AI review of your latest assessment
            </p>
            {latestNote.score !== null && (
              <Badge variant={latestNote.passed ? "success" : "warning"}>
                {latestNote.score}% {latestNote.passed ? "passed" : "not yet passed"}
              </Badge>
            )}
          </div>
          <p className="mt-2 font-display text-lg font-semibold text-brand-ink">{latestNote.assessment}</p>
          {latestNote.context && <p className="text-sm text-gray-600">{latestNote.context}</p>}
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-brand-ink">{latestNote.narrative}</p>
          <p className="mt-2 text-xs text-gray-600">{new Date(latestNote.when).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </Card>
      )}

      {courses.length > 0 && (
        <Card>
          <h2 className="font-display text-base font-semibold text-brand-ink">Your courses</h2>
          <ul className="mt-3 space-y-3">
            {courses.map((c) => {
              const pct = c.totalModules ? Math.round((c.completedModules / c.totalModules) * 100) : 0;
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    {sample ? <span className="font-semibold text-brand-ink">{c.title}</span> : (
                      <Link href={c.href} className="font-semibold text-brand-ink hover:text-brand-teal">
                        {c.title}
                      </Link>
                    )}
                    <span className="tabular-nums text-xs text-gray-600">
                      {c.completedModules} of {c.totalModules} modules
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-gray/60"
                    role="progressbar"
                    aria-label={`${c.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                  >
                    <div className="h-full rounded-full bg-brand-teal" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card variant="celebratory">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-goldText">Suggested next step</p>
        <p className="mt-1 text-sm text-brand-ink">{nextStep.text}</p>
        {sample ? null : (
          <Link href={nextStep.href} className="mt-2 inline-block text-sm font-semibold text-brand-teal hover:underline">
            {nextStep.label}
          </Link>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-gray bg-brand-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-brand-ink">{value}</p>
      <p className="mt-0.5 text-xs text-gray-600">{note}</p>
    </div>
  );
}

function TopicList({ items, empty, tone }: { items: TopicCount[]; empty: string; tone: "strong" | "focus" }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-gray-600">{empty}</p>;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((t) => (
        <li key={t.topic}>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
              tone === "strong" ? "bg-brand-mint text-brand-teal" : "bg-brand-goldLight text-brand-goldText"
            }`}
          >
            {t.topic}
            {t.count > 1 && <span className="text-xs font-normal">{tone === "focus" ? `recurring, ${t.count} assessments` : `${t.count} assessments`}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
