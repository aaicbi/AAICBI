"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

type Pool = "PRACTICE" | "FORMAL";

const SIDES: { pool: Pool; label: string; short: string; blurb: string }[] = [
  { pool: "PRACTICE", label: "Games and practice", short: "games and practice", blurb: "Used by quiz games and practice. Learners see these as many times as they like, with hints." },
  { pool: "FORMAL", label: "Assessment", short: "the assessment", blurb: "Used only in the formal assessment. Never shown in games or practice." },
];
const other = (p: Pool): Pool => (p === "PRACTICE" ? "FORMAL" : "PRACTICE");
const sideOf = (p: Pool) => SIDES.find((x) => x.pool === p)!;

interface BankQuestion {
  id: string;
  pool: Pool | null;
  objectiveId: string | null;
  bucket: "AWAITING_REVIEW" | "READY" | "FLAGGED";
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string | null;
  reasons: string[];
  reviewedBy: string | null;
}

interface BankSide {
  approved: number;
  awaiting: number;
  ready: number;
  flagged: number;
  need: number;
}
interface BankObjective {
  id: string;
  text: string;
  approved: number;
  sides: Record<Pool, BankSide>;
  unassigned: number;
}
interface ApprovedQuestion {
  id: string;
  objectiveId: string | null;
  pool: Pool | null;
  text: string;
  options: { text: string; isCorrect: boolean }[];
}

interface BankOverview {
  models: { generator: string; reviewer: string; independent: boolean };
  minimums: { practice: number; formal: number };
  objectives: BankObjective[];
  questions: BankQuestion[];
  approvedQuestions: ApprovedQuestion[];
  legacyCount: number;
  totals: { awaiting: number; ready: number; flagged: number; approved: number };
}

async function post(moduleId: string, body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(`/api/admin/studio/modules/${moduleId}/bank`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, json: await res.json().catch(() => ({})) };
}

const short = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n)}…` : t);

function Options({ options }: { options: { text: string; isCorrect: boolean }[] }) {
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs">
      {options.map((o, i) => (
        <li key={i} className={o.isCorrect ? "font-semibold text-brand-tealDeep" : "text-gray-700"}>
          {String.fromCharCode(65 + i)}) {o.text}
          {o.isCorrect && <span className="ml-1">✓</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The module's question bank inside the studio, in two kept-apart sides: games and practice, and the assessment. Each question is
 * written for one side, reviewed by a second Claude model, and approved by a person on that side, so nothing meant for the
 * assessment turns up in a game. A question can be lent to the other side on purpose, as a separate copy.
 */
export default function BankPanel({ moduleId, moduleTitle, canUse, onChanged, refreshKey }: { moduleId: string; moduleTitle: string; canUse: boolean; onChanged: () => void; refreshKey?: unknown }) {
  const { showToast } = useToast();
  const [data, setData] = useState<BankOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ text: string; options: { text: string; isCorrect: boolean }[] }>({ text: "", options: [] });
  const [showPassed, setShowPassed] = useState(false);
  const [showApproved, setShowApproved] = useState(false);
  const [tab, setTab] = useState<Pool>("PRACTICE");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/studio/modules/${moduleId}/bank`);
    if (!res.ok) {
      setError("Could not load the question bank.");
      return;
    }
    setData((await res.json()) as BankOverview);
  }, [moduleId]);

  // A different module starts clean; a refresh of the same module (Loop changed something) just reloads in place.
  useEffect(() => {
    setData(null);
    setError(null);
    setEditing(null);
  }, [moduleId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function decide(body: Record<string, unknown>, okMessage: (j: Record<string, unknown>) => string) {
    setBusy(true);
    setError(null);
    const r = await post(moduleId, body);
    setBusy(false);
    if (!r.ok) {
      setError(String(r.json.error ?? "That didn't work."));
      return;
    }
    showToast(okMessage(r.json), "success");
    setEditing(null);
    await load();
    onChanged();
  }

  const approveMessage = (j: Record<string, unknown>) => {
    const split = (j.split ?? {}) as { practice?: number; formal?: number };
    const extra = (split.practice ?? 0) + (split.formal ?? 0) > 0 ? ` (${split.practice ?? 0} older ones went to games and practice, ${split.formal ?? 0} to the assessment)` : "";
    const n = Number(j.approved ?? 0);
    return `Approved ${n} question${n === 1 ? "" : "s"}${extra}.`;
  };

  function startEdit(q: BankQuestion) {
    setEditing(q.id);
    setDraft({ text: q.text, options: q.options.map((o) => ({ ...o })) });
  }

  if (!data) {
    return (
      <Card data-testid="bank-card">
        <h3 className="text-sm font-semibold text-brand-ink">Question bank</h3>
        <p className="mt-1 text-xs text-gray-600">{error ?? "Loading…"}</p>
      </Card>
    );
  }

  const mine = data.questions.filter((q) => q.pool === tab);
  const passed = mine.filter((q) => q.bucket === "READY");
  const flagged = mine.filter((q) => q.bucket === "FLAGGED");
  const approvedHere = data.approvedQuestions.filter((q) => q.pool === tab);
  const approvedElsewhere = data.approvedQuestions.filter((q) => q.pool === other(tab));
  const unassigned = data.questions.filter((q) => q.pool === null).length + data.approvedQuestions.filter((q) => q.pool === null).length;
  const totalNeed = data.objectives.reduce((n, o) => n + o.sides[tab].need, 0);
  const side = sideOf(tab);
  const minimum = tab === "PRACTICE" ? data.minimums.practice : data.minimums.formal;
  const objectiveName = (id: string | null) => data.objectives.find((o) => o.id === id)?.text ?? "";
  const count = (p: Pool, key: "awaiting" | "ready" | "flagged") => data.objectives.reduce((n, o) => n + o.sides[p][key], 0);
  const attention = (p: Pool) => count(p, "awaiting") + count(p, "ready") + count(p, "flagged");

  const questionCard = (q: BankQuestion, flaggedCard: boolean) => (
    <li key={q.id} className="rounded-xl border border-brand-gray bg-brand-surface p-2.5" data-testid="bank-question" data-bucket={q.bucket}>
      {editing === q.id ? (
        <div className="space-y-2">
          <Textarea label="Question" value={draft.text} rows={3} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} />
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input
                label={`Option ${String.fromCharCode(65 + i)}`}
                wrapperClassName="flex-1"
                value={o.text}
                onChange={(e) => setDraft((d) => ({ ...d, options: d.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))}
              />
              <label className="mb-2 flex items-center gap-1 text-xs text-gray-700">
                <input type="radio" name={`correct-${q.id}`} checked={o.isCorrect} onChange={() => setDraft((d) => ({ ...d, options: d.options.map((x, j) => ({ ...x, isCorrect: j === i })) }))} />
                Correct
              </label>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void decide({ action: "edit", id: q.id, text: draft.text, options: draft.options }, () => "Saved. Approve it when you are ready.")} data-testid="bank-save-edit">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{short(objectiveName(q.objectiveId), 80)}</p>
          <p className="mt-0.5 text-sm font-medium text-brand-ink">{q.text}</p>
          <Options options={q.options} />
          {flaggedCard && q.reasons.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-lg bg-brand-roseLight px-2.5 py-1.5 text-xs text-brand-rose" data-testid="bank-reasons">
              {q.reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant={flaggedCard ? "secondary" : "primary"} disabled={busy || !canUse} iconLeft={<Icon icon={Check} size="sm" />} onClick={() => void decide({ action: "approve", ids: [q.id] }, approveMessage)} data-testid={flaggedCard ? "bank-approve-anyway" : "bank-approve-one"}>
              {flaggedCard ? "Approve anyway" : "Approve"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy || !canUse} iconLeft={<Icon icon={Pencil} size="sm" />} onClick={() => startEdit(q)} data-testid="bank-edit">
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={busy || !canUse} iconLeft={<Icon icon={X} size="sm" />} onClick={() => void decide({ action: "reject", ids: [q.id] }, () => "Rejected.")} data-testid="bank-reject">
              Reject
            </Button>
          </div>
        </>
      )}
    </li>
  );

  return (
    <Card data-testid="bank-card">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-brand-ink">Question bank for {moduleTitle}</h3>
      </div>
      <p className="mt-1 text-xs text-gray-600" data-testid="bank-intro">
        Questions arrive by importing a reviewed content file (below). Approve them here, one side at a time.
      </p>

      <div role="tablist" aria-label="Question bank" className="mt-3 flex gap-2">
        {SIDES.map((x) => (
          <button
            key={x.pool}
            type="button"
            role="tab"
            aria-selected={tab === x.pool}
            data-testid={`bank-tab-${x.pool}`}
            onClick={() => {
              setTab(x.pool);
              setEditing(null);
              setShowPassed(false);
              setShowApproved(false);
            }}
            className={`min-h-[44px] flex-1 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${tab === x.pool ? "border-brand-teal bg-brand-mint text-brand-ink" : "border-brand-gray bg-brand-surface text-gray-700 hover:border-brand-teal"}`}
          >
            {x.label}
            {attention(x.pool) > 0 && <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand-gold px-1.5 text-xs text-brand-onGold">{attention(x.pool)}</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-600" data-testid="bank-side-blurb">
        {side.blurb} <span className="font-medium">{approvedHere.length} approved</span>, {minimum} needed for each objective.
      </p>

      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-brand-roseLight px-3 py-2 text-xs text-brand-rose" data-testid="bank-error">
          {error}
        </p>
      )}

      {!canUse && <p className="mt-2 text-xs text-gray-600">You can see the bank here, but writing, reviewing and approving needs the question-bank permission. Ask a Super Admin.</p>}

      {canUse && unassigned > 0 && (
        <div className="mt-3 rounded-2xl bg-brand-goldLight/60 px-3 py-2 text-xs text-brand-ink" data-testid="bank-unassigned">
          <p>
            {unassigned} older question{unassigned === 1 ? " has" : "s have"} no purpose yet, so {unassigned === 1 ? "it isn't" : "they aren't"} in either side. Choose where {unassigned === 1 ? "it belongs" : "they belong"}:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SIDES.map((x) => (
              <Button key={x.pool} size="sm" variant="secondary" disabled={busy} data-testid={`bank-assign-${x.pool}`} onClick={() => void decide({ action: "assign", allUnassigned: true, pool: x.pool }, (j) => `${j.assigned ?? 0} set for ${x.short}.`)}>
                All for {x.short}
              </Button>
            ))}
          </div>
        </div>
      )}

      {data.objectives.length === 0 && <p className="mt-2 text-xs text-gray-600">This module has no learning objectives yet. Import a content file below; it adds them.</p>}
      {canUse && totalNeed > 0 && data.objectives.length > 0 && <p className="mt-2 text-xs text-gray-600">{totalNeed} more question{totalNeed === 1 ? " is" : "s are"} needed on this side across the objectives. Import more content, or use &ldquo;Tidy this module&rsquo;s objectives&rdquo; below.</p>}

      {passed.length > 0 && (
        <div className="mt-4" data-testid="bank-passed">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-brand-ink">{passed.length} passed the review</p>
            {canUse && (
              <Button size="sm" disabled={busy} onClick={() => void decide({ action: "approve", allPassed: true, pool: tab }, approveMessage)} data-testid="bank-approve-passed">
                Approve all {passed.length} that passed
              </Button>
            )}
            <button type="button" aria-expanded={showPassed} onClick={() => setShowPassed((v) => !v)} className="text-xs font-semibold text-brand-teal underline">
              {showPassed ? "Hide them" : "Read them first"}
            </button>
          </div>
          <p className="mt-0.5 text-xs text-gray-600">The reviewer worked out each answer from the lesson material on its own and found no problem. Approving puts them live for {side.short}.</p>
          {showPassed && <ul className="mt-2 space-y-2">{passed.map((q) => questionCard(q, false))}</ul>}
        </div>
      )}

      {flagged.length > 0 && (
        <div className="mt-4" data-testid="bank-flagged">
          <p className="text-sm font-semibold text-brand-ink">{flagged.length} need your decision</p>
          <p className="mt-0.5 text-xs text-gray-600">The reviewer found a problem with these. Fix it, throw it out, or approve it if you know it is right.</p>
          <ul className="mt-2 space-y-2">{flagged.map((q) => questionCard(q, true))}</ul>
        </div>
      )}

      {approvedHere.length > 0 && (
        <div className="mt-4" data-testid="bank-approved">
          <button type="button" aria-expanded={showApproved} onClick={() => setShowApproved((v) => !v)} className="text-sm font-semibold text-brand-teal underline" data-testid="bank-approved-toggle">
            {showApproved ? "Hide" : "See"} the {approvedHere.length} approved for {side.short}
          </button>
          {showApproved && (
            <ul className="mt-2 space-y-2">
              {approvedHere.map((q) => (
                <li key={q.id} className="rounded-xl border border-brand-gray bg-brand-surface p-2.5" data-testid="bank-approved-question">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">{short(objectiveName(q.objectiveId), 80)}</p>
                  <p className="mt-0.5 text-sm font-medium text-brand-ink">{q.text}</p>
                  <Options options={q.options} />
                  {canUse && (
                    <div className="mt-2">
                      <Button size="sm" variant="ghost" disabled={busy} data-testid="bank-copy" onClick={() => void decide({ action: "copy", ids: [q.id], to: other(tab) }, (j) => (Number(j.copied ?? 0) > 0 ? `Copied to ${sideOf(other(tab)).short}. It is now a separate question there.` : `${sideOf(other(tab)).label} already has this question.`))}>
                        Also use for {sideOf(other(tab)).short}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {showApproved && approvedElsewhere.length > 0 && <p className="mt-2 text-xs text-gray-500">{approvedElsewhere.length} more are approved for {sideOf(other(tab)).short}. Open that tab to lend one to this side.</p>}
        </div>
      )}

      {data.legacyCount > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {data.legacyCount} older question{data.legacyCount === 1 ? "" : "s"} in this module's assessment were imported or written by hand. They are not part of this bank flow and don't count toward practice.
        </p>
      )}
    </Card>
  );
}
