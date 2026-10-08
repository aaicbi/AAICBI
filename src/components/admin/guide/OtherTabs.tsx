"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { GUIDE_DESTINATIONS } from "@/lib/guide/navigation";
import { CONTROL_TARGETS } from "@/lib/guide/controlTargets";
import { PRIORITY_VARIANT, ROLE_LABEL, STATUS_LABEL, dateTime, type EntryDto, type Metrics, type QuestionDto } from "@/components/admin/guide/shared";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-brand-gray bg-brand-surface p-3">
      <p className="font-display text-2xl font-semibold tabular-nums text-brand-ink">{value}</p>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

/** Numbers for the last 30 days, the queue, and where people get stuck (a signal for the product, not only for the guide). */
export function OverviewTab({ m, onOpenQueue }: { m: Metrics; onOpenQueue: (feature?: string) => void }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="ov-heading">
        <h2 id="ov-heading" className="font-display text-lg font-semibold text-brand-ink">Last {m.days} days</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Questions asked" value={m.questions} />
          <Stat label="Answered" value={m.answered} />
          <Stat label="Could not answer" value={m.unanswered} />
          <Stat label="Answered with low confidence" value={m.lowConfidence} />
          <Stat label="Resolution rate" value={m.resolutionRate === null ? "n/a" : `${m.resolutionRate}%`} hint="Answered out of all asked" />
          <Stat label="Marked helpful" value={m.helpful} hint={`${m.notHelpful} marked not helpful`} />
          <Stat label="Take me there / Show me" value={m.navigations} />
          <Stat label="Guided tours started" value={m.tours} />
        </div>
      </section>

      <section aria-labelledby="ov-queue">
        <h2 id="ov-queue" className="font-display text-lg font-semibold text-brand-ink">Review queue</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Needs review" value={m.queue.open} />
          <Stat label="In review" value={m.queue.inReview} />
          <Stat label="Answered" value={m.queue.answered} />
          <Stat label="Approved answers" value={m.knowledge.entries} hint={`${m.knowledge.addedThisWeek} added this week`} />
        </div>
        {m.averageOpenConfidence !== null && <p className="mt-2 text-xs text-gray-600">Average confidence of waiting questions: {Math.round(m.averageOpenConfidence * 100)}%.</p>}
      </section>

      <section aria-labelledby="ov-top">
        <h2 id="ov-top" className="font-display text-lg font-semibold text-brand-ink">Most asked, still unanswered</h2>
        {m.topUnanswered.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Nothing is waiting.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {m.topUnanswered.map((t) => (
              <li key={t.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-brand-ink">{t.text}</p>
                  <span className="flex items-center gap-2">
                    <Badge variant={PRIORITY_VARIANT[t.priority as keyof typeof PRIORITY_VARIANT] ?? "neutral"}>{t.priority.toLowerCase()}</Badge>
                    <span className="text-xs text-gray-600">asked {t.asked}</span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Button className="mt-3" size="sm" variant="secondary" onClick={() => onOpenQueue()}>Open the review queue</Button>
      </section>

      <section aria-labelledby="ov-struggle">
        <h2 id="ov-struggle" className="font-display text-lg font-semibold text-brand-ink">Where people are getting stuck</h2>
        <p className="mt-1 text-sm text-gray-600">Unanswered questions grouped by the part of the product they were asked on. Many questions about one area can mean it is hard to find or labelled unclearly: worth a look at the navigation, wording or onboarding, not only a written answer.</p>
        {m.struggles.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Not enough questions yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {m.struggles.map((s) => (
              <li key={s.feature}>
                <button type="button" onClick={() => onOpenQueue(s.feature)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-gray bg-brand-surface px-3 py-2.5 text-left hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                  <span className="min-w-0 break-words text-sm font-semibold text-brand-ink">{s.feature}</span>
                  <span className="shrink-0 text-xs text-gray-600">{s.asked} {s.asked === 1 ? "ask" : "asks"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Frequently asked: the answers used most, and the unanswered topics asked most. */
export function FaqTab({ entries, m }: { entries: EntryDto[]; m: Metrics }) {
  const byUse = [...entries].filter((e) => e.served > 0).sort((a, b) => b.served - a.served).slice(0, 15);
  return (
    <div className="space-y-6">
      <section aria-labelledby="faq-used">
        <h2 id="faq-used" className="font-display text-lg font-semibold text-brand-ink">Answers given most</h2>
        <p className="mt-1 text-sm text-gray-600">Counted when Loop gave the answer. Only the count is kept, never who asked.</p>
        {byUse.length === 0 ? (
          <div className="mt-3"><EmptyState title="Nothing counted yet" description="Once Loop gives your written answers, the most used ones show here." /></div>
        ) : (
          <ul className="mt-3 space-y-2">
            {byUse.map((e) => (
              <li key={e.id}>
                <Card className="flex items-center justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-semibold text-brand-ink">{e.question}</p>
                  <Badge variant="neutral">{e.served}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="faq-open">
        <h2 id="faq-open" className="font-display text-lg font-semibold text-brand-ink">Asked most, not answered yet</h2>
        {m.topUnanswered.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {m.topUnanswered.map((t) => (
              <li key={t.id}>
                <Card className="flex items-center justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-semibold text-brand-ink">{t.text}</p>
                  <Badge variant="warning">{t.asked}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface History {
  changes: Array<{ id: string; entryId: string; version: number; action: string; question: string; changedByName: string | null; changeNote: string | null; changedAt: string }>;
  decided: Array<{ id: string; text: string; status: string; asked: number; reviewedAt: string; reviewNote: string | null; entryId: string | null }>;
}

/** What changed and what was decided, newest first. */
export function HistoryTab() {
  const [h, setH] = useState<History | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/admin/guide/history").then((r) => (r.ok ? r.json() : Promise.reject())).then(setH).catch(() => setError(true));
  }, []);
  if (error) return <ErrorState message="Could not load the history." onRetry={() => location.reload()} />;
  if (!h) return <SkeletonList rows={3} />;
  return (
    <div className="space-y-6">
      <section aria-labelledby="h-changes">
        <h2 id="h-changes" className="font-display text-lg font-semibold text-brand-ink">Changes to answers</h2>
        {h.changes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No answers written yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {h.changes.map((c) => (
              <li key={c.id}>
                <Card className="space-y-0.5">
                  <p className="break-words text-sm font-semibold text-brand-ink">{c.question}</p>
                  <p className="text-xs text-gray-600">Version {c.version} · {c.action.toLowerCase()} by {c.changedByName ?? "unknown"} · {dateTime(c.changedAt)}</p>
                  {c.changeNote && <p className="text-xs text-gray-700">{c.changeNote}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="h-decided">
        <h2 id="h-decided" className="font-display text-lg font-semibold text-brand-ink">Decisions on questions</h2>
        {h.decided.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No questions decided yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {h.decided.map((d) => (
              <li key={d.id}>
                <Card className="space-y-0.5">
                  <p className="break-words text-sm font-semibold text-brand-ink">{d.text}</p>
                  <p className="text-xs text-gray-600">{STATUS_LABEL[d.status] ?? d.status} · asked {d.asked} · {dateTime(d.reviewedAt)}</p>
                  {d.reviewNote && <p className="text-xs text-gray-700">{d.reviewNote}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Categories in use, with how many approved answers each has. */
export function CategoriesTab({ entries, categories }: { entries: EntryDto[]; categories: string[] }) {
  const count = (c: string) => entries.filter((e) => e.category === c).length;
  const none = entries.filter((e) => !e.category).length;
  return (
    <section aria-labelledby="cat-heading">
      <h2 id="cat-heading" className="font-display text-lg font-semibold text-brand-ink">Knowledge categories</h2>
      <p className="mt-1 text-sm text-gray-600">Categories group answers and questions for the team. Type a new one when writing an answer and it appears here. They are never shown to visitors.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c}>
            <Card className="flex items-center justify-between gap-3">
              <span className="min-w-0 break-words text-sm font-semibold text-brand-ink">{c}</span>
              <Badge variant="neutral">{count(c)} {count(c) === 1 ? "answer" : "answers"}</Badge>
            </Card>
          </li>
        ))}
        <li>
          <Card className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-gray-700">No category</span>
            <Badge variant="neutral">{none}</Badge>
          </Card>
        </li>
      </ul>
    </section>
  );
}

/** What Loop can point at: every menu item (by account type) and the controls that carry an id. */
export function TargetsTab() {
  const groups = ["trainee", "employer", "investor", "organization", "staff"] as const;
  return (
    <section aria-labelledby="t-heading" className="space-y-4">
      <div>
        <h2 id="t-heading" className="font-display text-lg font-semibold text-brand-ink">Things Loop can point at</h2>
        <p className="mt-1 text-sm text-gray-600">Menu items are listed automatically from the real menus, so a renamed page is followed. Other controls are listed when a developer marks them. Use these ids in &ldquo;Control to light up&rdquo; when writing an answer.</p>
      </div>
      <details open className="rounded-xl border border-brand-gray bg-brand-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand-teal">Controls ({CONTROL_TARGETS.length})</summary>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {CONTROL_TARGETS.map((c) => (
            <li key={c.id}><code className="rounded bg-brand-sand px-1">{c.id}</code> — {c.label}</li>
          ))}
        </ul>
      </details>
      {groups.map((g) => {
        const items = GUIDE_DESTINATIONS.filter((d) => d.audience.includes(g));
        return (
          <details key={g} className="rounded-xl border border-brand-gray bg-brand-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand-teal">{ROLE_LABEL[g]} menu ({items.length})</summary>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {items.map((d) => (
                <li key={d.target} className="break-words"><code className="rounded bg-brand-sand px-1">{d.target}</code> — {d.label}</li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}

export function SettingsTab({ enabled, busy, onToggle, limit }: { enabled: boolean; busy: boolean; onToggle: (v: boolean) => void; limit: number }) {
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink">Loop on every page</h2>
            <p className="mt-1 text-sm text-gray-600">Loop answers from approved written answers and the built-in guides, takes visitors to the right page, and can point at the control they need. No AI service is used, so it never invents an answer. Switching it off removes Loop from every page and brings back the plain Page Help button.</p>
          </div>
          <Toggle checked={enabled} label="Loop on every page" onChange={onToggle} disabled={busy} />
        </div>
        <p className="text-xs text-gray-600">Changes reach visitors within a minute.</p>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-brand-ink">How Loop learns</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>Loop cannot answer, or answers with low confidence, or someone marks an answer not helpful.</li>
          <li>The question is kept, scrubbed, and grouped with similar questions.</li>
          <li>A person reviews it and writes or approves the answer.</li>
          <li>Only then does Loop use it. Visitors can never teach Loop directly.</li>
          <li>The Claude consultant, when you switch it on in its own tab, can propose drafts for step 3. It is advice only; you still approve.</li>
        </ol>
        <p className="text-xs text-gray-600">You can keep up to {limit} approved answers. Every change is kept as a version.</p>
      </Card>
    </div>
  );
}
