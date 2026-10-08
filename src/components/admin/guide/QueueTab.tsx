"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { PRIORITY_VARIANT, ROLE_LABEL, STATUS_LABEL, date, type EntryDto, type QuestionDto } from "@/components/admin/guide/shared";

const STATUS_FILTERS: Array<[string, string]> = [["WAITING", "Waiting for review"], ["OPEN", "Needs review"], ["IN_REVIEW", "In review"], ["ANSWERED", "Answered"], ["REJECTED", "Rejected"], ["MERGED", "Merged"], ["DISMISSED", "Dismissed"]];

/**
 * The review queue: every question Loop could not answer, or answered with
 * low confidence, grouped by meaning with how often it was asked, by whom
 * (kind of account), and where. Nothing here becomes something Loop says
 * until a person writes or approves the answer.
 */
export default function QueueTab({
  entries,
  categories,
  busy,
  call,
  onAnswer,
  initialFeature,
}: {
  entries: EntryDto[];
  categories: string[];
  busy: boolean;
  call: (url: string, method: string, payload?: unknown) => Promise<boolean>;
  onAnswer: (q: QuestionDto) => void;
  initialFeature?: string;
}) {
  const [status, setStatus] = useState("WAITING");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState("");
  const [feature, setFeature] = useState(initialFeature ?? "");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<QuestionDto[] | null>(null);
  const [error, setError] = useState(false);
  const [merging, setMerging] = useState<QuestionDto | null>(null);
  const [rejecting, setRejecting] = useState<QuestionDto | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    setError(false);
    const sp = new URLSearchParams({ status });
    if (role) sp.set("role", role);
    if (category) sp.set("category", category);
    if (feature) sp.set("feature", feature);
    if (q.trim()) sp.set("q", q.trim());
    fetch(`/api/admin/guide/unanswered?${sp}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.questions))
      .catch(() => setError(true));
  }, [status, role, category, feature, q]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  async function act(row: QuestionDto, payload: unknown) {
    if (await call(`/api/admin/guide/unanswered/${row.id}`, "POST", payload)) load();
  }

  return (
    <section aria-labelledby="queue-heading" className="space-y-4">
      <div>
        <h2 id="queue-heading" className="font-display text-lg font-semibold text-brand-ink">Questions Loop could not answer</h2>
        <p className="mt-1 text-sm text-gray-600">Highest priority first. Write the answer once and Loop uses it for everyone with similar questions. Emails, links and numbers are removed before a question is kept, and nothing about who asked is stored.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select label="Show" compact value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Select label="Asked by" compact value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Anyone</option>
          {Object.entries(ROLE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Select label="Category" compact value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Any</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Input label="Area of the product" compact value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="trainee/messages" />
        <Input label="Search" compact type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions…" />
      </div>

      {error ? (
        <ErrorState message="Could not load the questions." onRetry={load} />
      ) : rows === null ? (
        <SkeletonList rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here" description="Questions Loop cannot answer will appear here, highest priority first." />
      ) : (
        <ul className="space-y-3">
          {rows.map((u) => (
            <li key={u.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-brand-ink">{u.text}</p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      Asked {u.asked} {u.asked === 1 ? "time" : "times"} · first {date(u.firstAskedAt)} · last {date(u.lastAskedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={PRIORITY_VARIANT[u.priority]}>{u.priority === "HIGH" ? "High priority" : u.priority === "MEDIUM" ? "Medium priority" : "Low priority"}</Badge>
                    <Badge variant="neutral">{STATUS_LABEL[u.status] ?? u.status}</Badge>
                    {u.confidence !== null && <Badge variant="neutral">Confidence {Math.round(u.confidence * 100)}%</Badge>}
                  </div>
                </div>

                {u.variants.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Also asked as</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                      {u.variants.map((v) => (
                        <li key={v} className="break-words">{v}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <dl className="grid gap-x-4 gap-y-1 text-xs text-gray-700 sm:grid-cols-2">
                  <div>
                    <dt className="inline font-semibold">Why it is here: </dt>
                    <dd className="inline">{u.reason === "NO_MATCH" ? "No answer matched" : u.reason === "LOW_CONFIDENCE" ? "Answered with low confidence" : "Marked not helpful"}</dd>
                  </div>
                  {u.lastPage && (
                    <div>
                      <dt className="inline font-semibold">Last asked on: </dt>
                      <dd className="inline break-words">{u.lastPage}{u.lastRoute ? ` (${u.lastRoute})` : ""}</dd>
                    </div>
                  )}
                  {u.feature && (
                    <div>
                      <dt className="inline font-semibold">Area: </dt>
                      <dd className="inline"><button type="button" className="font-semibold text-brand-teal underline" onClick={() => setFeature(u.feature!)}>{u.feature}</button></dd>
                    </div>
                  )}
                  {Object.keys(u.roleCounts).length > 0 && (
                    <div>
                      <dt className="inline font-semibold">Asked by: </dt>
                      <dd className="inline">{Object.entries(u.roleCounts).map(([r, n]) => `${ROLE_LABEL[r] ?? r} ${n}`).join(", ")}</dd>
                    </div>
                  )}
                  {u.attempted && (
                    <div className="sm:col-span-2">
                      <dt className="inline font-semibold">Closest answer Loop tried: </dt>
                      <dd className="inline break-words">{u.attempted}</dd>
                    </div>
                  )}
                  {u.context.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="inline font-semibold">What was asked just before: </dt>
                      <dd className="inline break-words">{u.context.join(" → ")}</dd>
                    </div>
                  )}
                  {u.reviewNote && (
                    <div className="sm:col-span-2">
                      <dt className="inline font-semibold">Note: </dt>
                      <dd className="inline break-words">{u.reviewNote}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  <Select label={`Category for "${u.text}"`} hideLabel compact value={u.category ?? ""} onChange={(e) => act(u, { action: "categorize", category: e.target.value })} disabled={busy} wrapperClassName="min-w-[10rem]">
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                  <span className="ml-auto flex flex-wrap gap-2">
                    {(u.status === "OPEN" || u.status === "IN_REVIEW") && (
                      <>
                        <Button size="sm" onClick={() => onAnswer(u)}>Write an answer</Button>
                        {u.status === "OPEN" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(u, { action: "review" })}>Start review</Button>}
                        <Button size="sm" variant="secondary" onClick={() => setMerging(u)}>Merge</Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(u, { action: "resolve" })}>Mark resolved</Button>
                        <Button size="sm" variant="secondary" onClick={() => { setNote(""); setRejecting(u); }}>Reject</Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(u, { action: "dismiss" })}>Dismiss</Button>
                      </>
                    )}
                    {(u.status === "DISMISSED" || u.status === "REJECTED" || u.status === "ANSWERED") && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(u, { action: "reopen" })}>Reopen</Button>
                    )}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!merging} onClose={() => setMerging(null)} title="Merge into…" size="lg">
        {merging && <MergeForm row={merging} entries={entries} rows={rows ?? []} busy={busy} onCancel={() => setMerging(null)} onMerge={async (body) => { await act(merging, { action: "merge", ...body }); setMerging(null); }} />}
      </Modal>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject this question" size="md">
        {rejecting && (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await act(rejecting, { action: "reject", note: note.trim() || undefined });
              setRejecting(null);
            }}
          >
            <p className="text-sm text-gray-700">Rejecting keeps the question on record with your reason, but Loop will not be given an answer for it. Use it for questions the guide should not answer.</p>
            <Textarea label="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button type="submit" loading={busy}>Reject</Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

function MergeForm({ row, entries, rows, busy, onCancel, onMerge }: { row: QuestionDto; entries: EntryDto[]; rows: QuestionDto[]; busy: boolean; onCancel: () => void; onMerge: (b: { intoQuestionId?: string; intoEntryId?: string }) => void }) {
  const [kind, setKind] = useState<"question" | "entry">("entry");
  const [pick, setPick] = useState("");
  const others = rows.filter((r) => r.id !== row.id && (r.status === "OPEN" || r.status === "IN_REVIEW"));
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pick) onMerge(kind === "entry" ? { intoEntryId: pick } : { intoQuestionId: pick });
      }}
    >
      <p className="text-sm text-gray-700">&ldquo;{row.text}&rdquo; is the same as something that already exists. Merging an existing answer adds this wording to it, so Loop finds it next time. Merging into another question adds the counts together.</p>
      <Select label="Merge into" value={kind} onChange={(e) => { setKind(e.target.value as "question" | "entry"); setPick(""); }}>
        <option value="entry">An existing answer</option>
        <option value="question">Another waiting question</option>
      </Select>
      <Select label={kind === "entry" ? "Answer" : "Question"} value={pick} onChange={(e) => setPick(e.target.value)} required>
        <option value="">Choose…</option>
        {kind === "entry"
          ? entries.map((e) => <option key={e.id} value={e.id}>{e.question}</option>)
          : others.map((o) => <option key={o.id} value={o.id}>{o.text} ({o.asked})</option>)}
      </Select>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={busy} disabled={!pick}>Merge</Button>
      </div>
    </form>
  );
}
