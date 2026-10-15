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
  plan: {
    objectives: { number: number; text: string; match: { how: string; existing: { text: string } | null }; counts: Record<string, Counts>; invalid: { kind: string; index: number; error: string }[] }[];
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

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/studio/modules/${moduleId}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(json.error ?? "The import didn't work."));
    return json;
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
      setPreview((await post({ file: parsed })) as Preview);
    } catch (e) {
      setFile(null);
      setError(e instanceof SyntaxError ? "That file couldn't be read. Choose the .json content file." : e instanceof Error ? e.message : "The file couldn't be checked.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = (await post({ file, apply: true, createGames: createGames && canMakeGames })) as Result;
      setDone(r);
      setPreview(null);
      showToast("Imported. Now approve what you want to go live.", "success");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import didn't work.");
    } finally {
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
          <p className="mt-3 text-xs font-semibold text-brand-ink">Objectives</p>
          <ul className="mt-1 space-y-1 text-xs text-gray-700">
            {preview.plan.objectives.map((o) => (
              <li key={o.number} data-testid="import-objective">
                <span className="font-medium">{o.text}</span> —{" "}
                {o.match.existing ? `matches “${o.match.existing.text}” (${o.match.how})` : "new objective, will be added"}
              </li>
            ))}
          </ul>
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
            {done.questions} quiz questions are waiting in the question bank (Games and practice tab: &ldquo;Approve all that passed&rdquo;). Drafts: {done.items.MATCHING} matching, {done.items.ORDERING} ordering, {done.items.SCENARIO} scenario: approve them in the
            studio. {done.objectivesCreated > 0 ? `${done.objectivesCreated} new objective${done.objectivesCreated === 1 ? "" : "s"} added. ` : ""}
            {done.gamesCreated.length > 0 ? `Games created (off): ${done.gamesCreated.join("; ")}. ` : ""}
            {done.skippedDuplicates > 0 ? `${done.skippedDuplicates} skipped because the module already had them.` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
