"use client";
import { useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Counts {
  create: number;
  duplicate: number;
  invalid: number;
}
interface Preview {
  moduleTitle: string;
  existing: { id: string; text: string }[];
  plan: {
    objectives: { number: number; text: string; match: { how: string; existing: { id: string; text: string } | null }; counts: Record<string, Counts>; invalid: { kind: string; index: number; error: string }[]; reserved: number; skipped: boolean }[];
    totals: Record<string, Counts>;
  };
}
interface Result {
  objectivesCreated: number;
  objectivesMatched: number;
  questions: number;
  items: { MATCHING: number; ORDERING: number; SCENARIO: number };
  gamesCreated: string[];
  skippedDuplicates: number;
  skippedInvalid: number;
}

const LABEL: Record<string, string> = { quiz: "Quiz questions", matching: "Matching sets", ordering: "Ordering sequences", scenario: "Scenarios" };

/**
 * Loads a reviewed content file (from the module-content skill) into the module. First it shows what would be saved and what the module
 * already has; only then does it save. Quiz questions arrive as "passed review" and game items as drafts, so a person still approves.
 */
export default function ImportPanel({ moduleId, moduleTitle, canUse, canMakeGames, onChanged }: { moduleId: string; moduleTitle: string; canUse: boolean; canMakeGames: boolean; onChanged: () => void }) {
  const { showToast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<unknown>(null);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [createGames, setCreateGames] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [reserve, setReserve] = useState(6);

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/studio/modules/${moduleId}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      if (json?.error) throw new Error(String(json.error));
      throw new Error(`The server stopped before it finished (it answered ${res.status}). Nothing is lost: choose the file and click Import again and it carries on where it stopped.`);
    }
    return json;
  }

  async function look(parsed: unknown, c: Record<string, string>, r: number) {
    setBusy(true);
    setError(null);
    try {
      setPreview((await post({ file: parsed, choices: c, reserve: r })) as Preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file couldn't be checked.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(f: File | undefined) {
    setError(null);
    setPreview(null);
    setDone(null);
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      setFile(parsed);
      setName(f.name);
      setBusy(true);
      setPreview((await post({ file: parsed, choices: {}, reserve })) as Preview);
    } catch (e) {
      setFile(null);
      setError(e instanceof SyntaxError ? "That file couldn't be read. Choose the .json content file." : e instanceof Error ? e.message : "The file couldn't be checked.");
    } finally {
      setBusy(false);
    }
  }

  /** What the person sees is what gets saved: every objective's current pairing is sent, so nothing is re-guessed between steps. */
  function pinned(): Record<string, string> {
    const out: Record<string, string> = {};
    preview?.plan.objectives.forEach((o, i) => {
      out[String(i)] = o.skipped ? "skip" : o.match.existing ? o.match.existing.id : "new";
    });
    return out;
  }

  async function run() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const total: Result = { objectivesCreated: 0, objectivesMatched: 0, questions: 0, items: { MATCHING: 0, ORDERING: 0, SCENARIO: 0 }, gamesCreated: [], skippedDuplicates: 0, skippedInvalid: 0 };
    try {
      // One objective at a time: a whole module in one request could outlast the server's time limit.
      const todo = preview.plan.objectives.map((o, i) => ({ o, i })).filter(({ o }) => Object.values(o.counts).some((c) => c.create > 0));
      for (const [n, { i }] of todo.entries()) {
        setProgress(`Importing objective ${n + 1} of ${todo.length}…`);
        const r = (await post({ file, apply: true, only: [i], choices: pinned(), reserve })) as Result;
        total.objectivesCreated += r.objectivesCreated;
        total.objectivesMatched += r.objectivesMatched;
        total.questions += r.questions;
        total.items.MATCHING += r.items.MATCHING;
        total.items.ORDERING += r.items.ORDERING;
        total.items.SCENARIO += r.items.SCENARIO;
        total.skippedDuplicates = r.skippedDuplicates;
      }
      if (createGames && canMakeGames) {
        setProgress("Setting up the games…");
        const r = (await post({ file, apply: true, only: [], createGames: true, choices: pinned(), reserve })) as Result;
        total.gamesCreated = r.gamesCreated;
      }
      setDone(total);
      setPreview(null);
      showToast("Imported. Now approve what you want to go live.", "success");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import didn't work.");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  const totalNew = preview ? Object.values(preview.plan.totals).reduce((n, c) => n + c.create, 0) : 0;

  return (
    <Card data-testid="import-card">
      <h3 className="text-sm font-semibold text-brand-ink">Import reviewed content into {moduleTitle}</h3>
      <p className="mt-1 text-xs text-gray-600">
        For a content file made from this module&apos;s lesson materials (quiz, matching, ordering and scenario items, already reviewed). You see what would be saved first. Nothing goes live: quiz questions arrive as
        &ldquo;passed review&rdquo; in the question bank and the other items arrive as drafts, for you to approve.
      </p>
      {!canUse && <p className="mt-2 text-xs text-gray-600">Importing needs the question-bank and item permissions. Ask a Super Admin.</p>}
      {canUse && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Content file" data-testid="import-file" onChange={(e) => void choose(e.target.files?.[0])} />
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()} data-testid="import-choose">
            Choose a content file
          </Button>
          {name && <span className="text-xs text-gray-600">{name}</span>}
        </div>
      )}
      {progress && (
        <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-brand-tealDeep" data-testid="import-progress">
          {progress}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-brand-roseLight px-3 py-2 text-xs text-brand-rose" data-testid="import-error">
          {error}
        </p>
      )}
      {preview && (
        <div className="mt-3" data-testid="import-preview">
          <p className="text-sm font-semibold text-brand-ink">
            {totalNew === 0 ? "Everything in this file is already in the module." : `${totalNew} new item${totalNew === 1 ? "" : "s"} would be saved.`}
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-gray-700">
            {Object.entries(preview.plan.totals).map(([k, c]) => (
              <li key={k}>
                {LABEL[k]}: <span className="font-semibold">{c.create}</span> new{c.duplicate > 0 ? `, ${c.duplicate} already there` : ""}
                {c.invalid > 0 ? `, ${c.invalid} can't be used` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold text-brand-ink">Which objective does each part of the file belong to?</p>
          <ul className="mt-1 space-y-2 text-xs text-gray-700">
            {preview.plan.objectives.map((o, i) => (
              <li key={o.number} data-testid="import-objective" className="rounded-xl border border-brand-gray bg-brand-surface p-2">
                <p className="font-medium text-brand-ink">{o.text}</p>
                <label className="mt-1 flex flex-wrap items-center gap-2">
                  <span>Goes to:</span>
                  <select
                    aria-label={`Where objective ${o.number} goes`}
                    data-testid="import-objective-choice"
                    disabled={busy}
                    value={o.skipped ? "skip" : o.match.existing ? o.match.existing.id : "new"}
                    onChange={(e) => {
                      const c = { ...pinned(), [String(i)]: e.target.value };
                      void look(file, c, reserve);
                    }}
                    className="min-h-[36px] max-w-full rounded-lg border border-brand-gray bg-brand-surface px-2 text-xs text-brand-ink"
                  >
                    <option value="new">Add it as a new objective</option>
                    {preview.existing.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.text.length > 90 ? `${e.text.slice(0, 90)}…` : e.text}
                      </option>
                    ))}
                    <option value="skip">Leave this part out</option>
                  </select>
                  {!o.skipped && o.match.how !== "new" && o.match.how !== "chosen" && <span className="text-gray-500">(matched by {o.match.how})</span>}
                </label>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-700">
            Set aside
            <input
              type="number"
              min={0}
              max={10}
              value={reserve}
              data-testid="import-reserve"
              aria-label="Quiz questions per objective to set aside for the assessment"
              onChange={(e) => setReserve(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              onBlur={() => void look(file, pinned(), reserve)}
              className="min-h-[36px] w-16 rounded-lg border border-brand-gray bg-brand-surface px-2 text-xs"
            />
            quiz questions per objective for the assessment (taken out of games and practice, not copied). The quiz game needs at least 6 for the assessment and 10 for practice per objective.
          </label>
          {preview.plan.objectives.some((o) => o.invalid.length > 0) && (
            <ul className="mt-2 space-y-0.5 rounded-xl bg-brand-goldLight/50 px-3 py-2 text-xs text-brand-ink">
              {preview.plan.objectives.flatMap((o) => o.invalid.map((x) => <li key={`${o.number}-${x.kind}-${x.index}`}>Skipped {x.kind} item {x.index + 1} of objective {o.number}: {x.error}</li>)).slice(0, 8)}
            </ul>
          )}
          {totalNew > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canMakeGames && (
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input type="checkbox" checked={createGames} onChange={(e) => setCreateGames(e.target.checked)} data-testid="import-games" />
                  Also create the games for this module (switched off until you make them live)
                </label>
              )}
              <Button size="sm" loading={busy} disabled={busy} onClick={() => void run()} data-testid="import-run">
                Import {totalNew} item{totalNew === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </div>
      )}
      {done && (
        <div className="mt-3 rounded-2xl bg-brand-mint px-3 py-2 text-xs text-brand-ink" data-testid="import-done">
          <p className="font-semibold">Imported.</p>
          <p className="mt-0.5">
            {done.questions} quiz questions are waiting in the question bank: open the Games and practice tab and the Assessment tab and use &ldquo;Approve all that passed&rdquo; on each. Drafts: {done.items.MATCHING} matching, {done.items.ORDERING} ordering, {done.items.SCENARIO} scenario: approve them in the
            studio. {done.objectivesCreated > 0 ? `${done.objectivesCreated} new objective${done.objectivesCreated === 1 ? "" : "s"} added. ` : ""}
            {done.gamesCreated.length > 0 ? `Games created (off): ${done.gamesCreated.join("; ")}. ` : ""}
            {done.skippedDuplicates > 0 ? `${done.skippedDuplicates} skipped because the module already had them.` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
