"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import MonitorPanel from "@/components/admin/guide/MonitorPanel";
import TrainPanel, { type TrainPrefill } from "@/components/admin/guide/TrainPanel";
import { ROLE_LABEL, dateTime, type ConsultantInfo, type DraftProposal, type SuggestionDto } from "@/components/admin/guide/shared";

const KIND_LABEL: Record<string, string> = { DRAFT_ANSWER: "Draft answer", IMPROVE_ANSWER: "Improve answer", MERGE: "Possible duplicate", REJECT: "Suggest rejecting", ADVICE: "Advice", REPORT: "Platform report", MATERIAL_REVIEW: "Materials review", AI_TRAINING: "Suggested guidance" };
const SECTIONS = [["answers", "Loop's answers"], ["monitor", "Platform monitor"], ["train", "Train the AI features"]] as const;
type Section = (typeof SECTIONS)[number][0];
const SECTION_KINDS: Record<Section, string[]> = { answers: ["DRAFT_ANSWER", "IMPROVE_ANSWER", "MERGE", "REJECT", "ADVICE"], monitor: ["REPORT", "MATERIAL_REVIEW"], train: ["AI_TRAINING"] };
const PRIORITY_BADGE = { high: "danger", medium: "warning", low: "neutral" } as const;

/**
 * The Claude consultant: advice for the super admin on teaching Loop. It
 * proposes, you decide. Nothing it writes is used by Loop until you review it
 * and save it through the normal answer form, and it never runs unless you
 * press a button while the switch is on.
 */
export default function ConsultantTab({
  info,
  busy,
  call,
  onToggle,
  onApproveDraft,
  refreshKey,
  onChanged,
}: {
  info: ConsultantInfo;
  busy: boolean;
  call: (url: string, method: string, payload?: unknown) => Promise<boolean>;
  onToggle: (v: boolean) => void;
  onApproveDraft: (s: SuggestionDto, draft: DraftProposal) => void;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<"PENDING" | "ALL">("PENDING");
  const [rows, setRows] = useState<SuggestionDto[] | null>(null);
  const [error, setError] = useState(false);
  const [asking, setAsking] = useState<"review" | "ask" | null>(null);
  const [question, setQuestion] = useState("");
  const [section, setSection] = useState<Section>("answers");
  const [prefill, setPrefill] = useState<TrainPrefill | null>(null);
  const { showToast } = useToast();
  const ready = info.enabled && info.configured;

  const load = useCallback(() => {
    setError(false);
    fetch(`/api/admin/guide/consultant/suggestions?status=${status}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.suggestions))
      .catch(() => setError(true));
  }, [status]);
  useEffect(load, [load, refreshKey]);

  async function run(kind: "review" | "ask") {
    setAsking(kind);
    const res = await fetch(`/api/admin/guide/consultant/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "ask" ? { question } : {}) });
    setAsking(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    if (kind === "ask") setQuestion("");
    showToast(kind === "review" ? d.message : "Claude's advice is below.", "success");
    load();
    onChanged();
  }

  async function decide(s: SuggestionDto, action: "approve" | "dismiss") {
    if (await call(`/api/admin/guide/consultant/suggestions/${s.id}`, "POST", { action })) {
      load();
      onChanged();
    }
  }

  async function applyMerge(s: SuggestionDto) {
    if (!s.questionId || !s.entryId) return;
    if (await call(`/api/admin/guide/unanswered/${s.questionId}`, "POST", { action: "merge", intoEntryId: s.entryId })) await decide(s, "approve");
  }
  async function applyReject(s: SuggestionDto) {
    if (!s.questionId) return;
    if (await call(`/api/admin/guide/unanswered/${s.questionId}`, "POST", { action: "reject", note: `Suggested by the Claude consultant: ${s.rationale}`.slice(0, 300) })) await decide(s, "approve");
  }

  const visible = (rows ?? []).filter((r) => SECTION_KINDS[section].includes(r.kind));

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink">Claude consultant</h2>
            <p className="mt-1 text-sm text-gray-700">
              An adviser in the Command Center. It helps you teach Loop, reports on the platform&apos;s analytics, lesson materials, assessments and performance, and suggests guidance for the AI features. It proposes; you decide.
            </p>
          </div>
          <Toggle checked={info.enabled} label="Claude consultant" onChange={onToggle} disabled={busy} />
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li><span className="font-semibold">Advice only.</span> It cannot publish, edit or delete anything, and it does not touch the running of the platform.</li>
          <li><span className="font-semibold">You approve.</span> Nothing it writes is used until you review it, edit it if needed and save it.</li>
          <li><span className="font-semibold">Only when you ask.</span> It never runs by itself. Each run uses your platform&apos;s Anthropic account, billed with the other AI features; runs are limited to 10 an hour.</li>
          <li><span className="font-semibold">Private.</span> It sees only scrubbed question text, counts, averages and the lesson text you ask it to review: never who anyone is, and no accounts, emails or messages.</li>
        </ul>
        {!info.enabled && <p className="rounded-lg bg-brand-mint px-3 py-2 text-sm text-brand-ink">It is switched off. Loop works exactly as before. Switch it on to ask for advice.</p>}
        {info.enabled && !info.configured && <p className="rounded-lg bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">It is on, but no Anthropic key is set up for this platform (<code>ANTHROPIC_API_KEY</code>), so it cannot run yet.</p>}
      </Card>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Consultant sections">
        {SECTIONS.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={section === v} onClick={() => setSection(v)} className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${section === v ? "bg-brand-teal text-brand-onAccent" : "bg-brand-mint text-brand-ink hover:bg-brand-teal/10"}`}>
            {l}
          </button>
        ))}
      </div>

      {section === "monitor" && <MonitorPanel ready={ready} onChanged={() => { load(); onChanged(); }} />}
      {section === "train" && <TrainPanel ready={ready} prefill={prefill} onPrefillUsed={() => setPrefill(null)} onChanged={() => { load(); onChanged(); }} />}

      {section === "answers" && ready && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">Review the waiting questions</h3>
              <p className="text-xs text-gray-600">Claude looks at the highest-priority questions that have no proposal yet (up to 12).</p>
            </div>
            <Button size="sm" onClick={() => run("review")} loading={asking === "review"} disabled={!!asking}>Ask Claude to review</Button>
          </div>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim().length >= 3) run("ask");
            }}
          >
            <Textarea label="Ask the consultant" value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={1000} placeholder="Which area of the product are visitors struggling with most, and what should we change?" hint="About Loop and what its questions reveal. It cannot change anything." />
            <Button type="submit" size="sm" variant="secondary" loading={asking === "ask"} disabled={!!asking || question.trim().length < 3}>Ask</Button>
          </form>
        </Card>
      )}

      <section aria-labelledby="sug-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="sug-heading" className="font-display text-base font-semibold text-brand-ink">Proposals and advice</h3>
          <div className="flex gap-1" role="group" aria-label="Show">
            {([["PENDING", "Waiting for you"], ["ALL", "Everything"]] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)} className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${status === v ? "bg-brand-teal text-brand-onAccent" : "text-gray-700 hover:bg-brand-mint"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <ErrorState message="Could not load the proposals." onRetry={load} />
        ) : rows === null ? (
          <SkeletonList rows={2} />
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing here yet" description={!ready ? "Switch the consultant on to get proposals." : section === "answers" ? "Press “Ask Claude to review” to get proposals for the waiting questions." : section === "monitor" ? "Ask Claude for a report or a materials review above." : "Use “Suggest a note” on an AI feature above."} />
        ) : (
          <ul className="space-y-3">
            {visible.map((s) => {
              const draft = s.kind === "DRAFT_ANSWER" ? (s.proposal.draft as DraftProposal | undefined) : undefined;
              const open = s.status === "PENDING";
              const stillWaiting = !s.question || s.question.status === "OPEN" || s.question.status === "IN_REVIEW";
              return (
                <li key={s.id}>
                  <Card className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-semibold text-brand-ink">{s.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="gold">{KIND_LABEL[s.kind] ?? s.kind}</Badge>
                        <Badge variant="neutral">Drafted by Claude · needs your review</Badge>
                        {!open && <Badge variant={s.status === "APPROVED" ? "success" : "neutral"}>{s.status === "APPROVED" ? "Approved" : "Dismissed"}</Badge>}
                        {typeof s.proposal.confidence === "string" && <Badge variant="neutral">Confidence {s.proposal.confidence}</Badge>}
                      </div>
                    </div>

                    {s.kind === "REPORT" ? (
                      <ReportBody p={s.proposal} />
                    ) : s.kind === "MATERIAL_REVIEW" ? (
                      <MaterialBody p={s.proposal} />
                    ) : s.kind === "AI_TRAINING" ? (
                      <div className="space-y-1.5">
                        {s.rationale && <p className="break-words text-sm text-gray-700"><span className="font-semibold">Why: </span>{s.rationale}</p>}
                        <p className="whitespace-pre-line break-words rounded-xl bg-brand-sand p-3 text-sm text-brand-ink">{String(s.proposal.note ?? "")}</p>
                      </div>
                    ) : s.kind === "ADVICE" ? (
                      <div className="space-y-2">
                        {s.rationale && !s.proposal.advice && <p className="text-sm text-gray-700">{s.rationale}</p>}
                        <p className="whitespace-pre-line break-words text-sm text-brand-ink">{String(s.proposal.advice ?? "")}</p>
                        {Array.isArray(s.proposal.nextSteps) && s.proposal.nextSteps.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700">Things you could try</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                              {(s.proposal.nextSteps as string[]).map((n) => (
                                <li key={n} className="break-words">{n}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {s.rationale && <p className="break-words text-sm text-gray-700"><span className="font-semibold">Why: </span>{s.rationale}</p>}
                        {draft && (
                          <div className="space-y-1.5 rounded-xl bg-brand-sand p-3 text-sm">
                            <p className="break-words font-semibold text-brand-ink">{draft.question}</p>
                            <p className="break-words text-brand-ink">{draft.answer}</p>
                            <p className="break-words text-xs text-gray-600">
                              {[draft.category && `Category: ${draft.category}`, draft.navHref && `Takes people to ${draft.navHref}`, draft.target && `Shows ${draft.target}`, draft.roles.length > 0 && `For ${draft.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}`].filter(Boolean).join(" · ") || "No destination or audience suggested."}
                            </p>
                            {draft.relatedQuestions.length > 0 && <p className="break-words text-xs text-gray-600">Also found by: {draft.relatedQuestions.join(" · ")}</p>}
                          </div>
                        )}
                      </>
                    )}

                    {s.warnings.length > 0 && (
                      <ul className="space-y-1">
                        {s.warnings.map((w, i) => (
                          <li key={i} className="rounded-lg bg-brand-goldLight px-2.5 py-1.5 text-xs text-brand-goldText">{w}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-gray-600">{dateTime(s.createdAt)} · {s.model}</p>

                    {open && (
                      <div className="flex flex-wrap justify-end gap-2">
                        {s.kind === "DRAFT_ANSWER" && draft && (
                          stillWaiting && s.question ? (
                            <Button size="sm" onClick={() => onApproveDraft(s, draft)}>Review and approve</Button>
                          ) : (
                            <span className="self-center text-xs text-gray-600">That question has already been dealt with.</span>
                          )
                        )}
                        {s.kind === "AI_TRAINING" && typeof s.proposal.feature === "string" && (
                          <Button size="sm" onClick={() => { setPrefill({ feature: s.proposal.feature as string, note: String(s.proposal.note ?? ""), suggestionId: s.id }); }}>Review and approve</Button>
                        )}
                        {s.kind === "MERGE" && s.entryId && stillWaiting && <Button size="sm" disabled={busy} onClick={() => applyMerge(s)}>Add as another way of asking</Button>}
                        {s.kind === "REJECT" && stillWaiting && <Button size="sm" disabled={busy} onClick={() => applyReject(s)}>Reject this question</Button>}
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide(s, s.kind === "ADVICE" || s.kind === "REPORT" || s.kind === "MATERIAL_REVIEW" ? "approve" : "dismiss")}>{s.kind === "ADVICE" || s.kind === "REPORT" || s.kind === "MATERIAL_REVIEW" ? "Got it" : "Dismiss"}</Button>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

type Finding = { area?: string; course?: string | null; finding?: string; suggestion?: string; priority?: "high" | "medium" | "low"; material?: string | null; quote?: string | null; issue?: string };

function Findings({ items, head }: { items: Finding[]; head: (f: Finding) => string }) {
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <li key={i} className="rounded-xl bg-brand-sand p-3 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            {f.priority && <Badge variant={PRIORITY_BADGE[f.priority]}>{f.priority}</Badge>}
            <span className="min-w-0 break-words font-semibold text-brand-ink">{head(f)}</span>
          </div>
          {f.quote && <p className="mt-1 break-words text-xs italic text-gray-600">“{f.quote}”</p>}
          {f.suggestion && <p className="mt-1 break-words text-gray-700"><span className="font-semibold">Try: </span>{f.suggestion}</p>}
        </li>
      ))}
    </ul>
  );
}

function ReportBody({ p }: { p: Record<string, unknown> }) {
  const findings = (p.findings as Finding[] | undefined) ?? [];
  const well = (p.goingWell as string[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line break-words text-sm text-brand-ink">{String(p.summary ?? "")}</p>
      {well.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700">Going well</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">{well.map((w) => <li key={w} className="break-words">{w}</li>)}</ul>
        </div>
      )}
      {findings.length > 0 && <Findings items={findings} head={(f) => `${f.area ? f.area.charAt(0).toUpperCase() + f.area.slice(1) : ""}${f.course ? ` · ${f.course}` : ""}: ${f.finding ?? ""}`} />}
    </div>
  );
}

function MaterialBody({ p }: { p: Record<string, unknown> }) {
  const issues = (p.issues as Finding[] | undefined) ?? [];
  const strengths = (p.strengths as string[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line break-words text-sm text-brand-ink">{String(p.summary ?? "")}</p>
      {strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700">Strengths</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">{strengths.map((w) => <li key={w} className="break-words">{w}</li>)}</ul>
        </div>
      )}
      {issues.length > 0 && <Findings items={issues} head={(f) => `${f.material ? `${f.material}: ` : ""}${f.issue ?? ""}`} />}
    </div>
  );
}
