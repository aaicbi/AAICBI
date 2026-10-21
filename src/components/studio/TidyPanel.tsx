"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import ExpandSelect from "@/components/ui/ExpandSelect";

export interface TidyObjective {
  id: string;
  text: string;
  practice: number;
  formal: number;
  questions: number;
  items: number;
}

/**
 * After an import, a module can have objectives that are empty, or that duplicate each other. This card merges one objective into another
 * (moving its questions and items across), removes an empty one, and fills the assessment side from spare practice questions.
 * Nothing here asks Claude for anything: it only moves what is already in the module.
 */
export default function TidyPanel({ moduleId, objectives, minimums, canUse, onChanged }: { moduleId: string; objectives: TidyObjective[]; minimums: { practice: number; formal: number }; canUse: boolean; onChanged: () => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, message: (j: Record<string, unknown>) => string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/modules/${moduleId}/tidy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error ?? "That didn't work."));
      showToast(message(json), "success");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const short = objectives.filter((o) => o.formal < minimums.formal || o.practice < minimums.practice);
  return (
    <Card data-testid="tidy-card">
      <h3 className="text-sm font-semibold text-brand-ink">Tidy this module&apos;s objectives</h3>
      <p className="mt-1 text-xs text-gray-600">
        Merge an objective into another (its questions and items move across), rename one, remove an empty one, or fill the assessment side from spare practice questions. Nothing here asks Claude for anything. The quiz game can only go live when every objective has at least {minimums.practice} practice and {minimums.formal} assessment questions.
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-brand-roseLight px-3 py-2 text-xs text-brand-rose" data-testid="tidy-error">
          {error}
        </p>
      )}
      {canUse && (
        <div className="mt-3">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void call({ action: "fillAssessment" }, (j) => `Moved ${j.moved ?? 0} spare practice questions to the assessment side.`)} data-testid="tidy-fill">
            Fill the assessment side ({minimums.formal} per objective, from spare practice questions)
          </Button>
        </div>
      )}
      <ul className="mt-3 space-y-2">
        {objectives.map((o) => {
          const empty = o.questions === 0 && o.items === 0;
          const ok = o.practice >= minimums.practice && o.formal >= minimums.formal;
          return (
            <li key={o.id} className="rounded-xl border border-brand-gray bg-brand-surface p-2.5" data-testid="tidy-objective" data-empty={empty ? "yes" : "no"}>
              <p className="text-sm text-brand-ink">{o.text}</p>
              <p className="mt-0.5 text-xs text-gray-600">
                Practice {o.practice}/{minimums.practice} · Assessment {o.formal}/{minimums.formal} · Game items {o.items} {ok ? "· ready" : empty ? "· empty" : "· short"}
              </p>
              {canUse && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    Merge into
                    <ExpandSelect compact
                      aria-label={`Merge “${o.text.slice(0, 40)}” into another objective`}
                      data-testid="tidy-merge"
                      disabled={busy}
                      value=""
                      onChange={(e) => {
                        const to = e.target.value;
                        if (!to) return;
                        const target = objectives.find((x) => x.id === to);
                        if (window.confirm(`Move everything from this objective into “${target?.text.slice(0, 80)}” and remove this one?`)) void call({ action: "merge", fromId: o.id, toId: to }, (j) => `Merged: ${j.questions ?? 0} questions and ${j.items ?? 0} items moved.`);
                      }}
                      className="min-h-[34px] max-w-[18rem] rounded-lg border border-brand-gray bg-brand-surface px-2 text-xs text-brand-ink"
                    >
                      <option value="">Choose…</option>
                      {objectives.filter((x) => x.id !== o.id).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.text.length > 70 ? `${x.text.slice(0, 70)}…` : x.text}
                        </option>
                      ))}
                    </ExpandSelect>
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    data-testid="tidy-rename"
                    onClick={() => {
                      const next = window.prompt("New wording for this objective:", o.text);
                      if (next !== null && next.trim() && next.trim() !== o.text) void call({ action: "rename", id: o.id, text: next }, () => "Renamed.");
                    }}
                  >
                    Rename
                  </Button>
                  {empty && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      data-testid="tidy-delete"
                      onClick={() => {
                        if (window.confirm("Remove this empty objective?")) void call({ action: "delete", id: o.id }, () => "Removed.");
                      }}
                    >
                      Remove (empty)
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {short.length > 0 && <p className="mt-2 text-xs text-gray-600">{short.length} objective{short.length === 1 ? " is" : "s are"} below the quiz game&apos;s minimums.</p>}
    </Card>
  );
}
