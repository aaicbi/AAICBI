"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { dateTime } from "@/components/admin/guide/shared";

interface Version { version: number; note: string; enabled: boolean; changedByName: string | null; changeNote: string | null; createdAt: string }
interface Feature { key: string; label: string; where: string; example: string; current: Version | null; versions: Version[] }
export interface TrainPrefill { feature: string; note: string; suggestionId: string }

const CONSULTANT_NOTE = "Drafted by the Claude consultant; reviewed and approved by a super admin";

/**
 * Training the platform's AI features. A guidance note is a short piece of
 * advice (tone, emphasis, local context) added after the feature's own fixed
 * rules. Only a person saves one, every change is a new version that can be
 * brought back, and it works with the consultant switched off. The consultant
 * can only suggest a note; saving it is your decision.
 */
export default function TrainPanel({ ready, prefill, onPrefillUsed, onChanged }: { ready: boolean; prefill: TrainPrefill | null; onPrefillUsed: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ features: Feature[]; notTrainable: Array<{ label: string; why: string }>; noteMax: number } | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [suggestionId, setSuggestionId] = useState<string | undefined>();
  const [goal, setGoal] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(false);
    fetch("/api/admin/guide/ai-guidance")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!prefill) return;
    setEditing(prefill.feature);
    setNote(prefill.note);
    setEnabled(true);
    setSuggestionId(prefill.suggestionId);
    setFormError(null);
    onPrefillUsed();
  }, [prefill, onPrefillUsed]);

  function edit(f: Feature) {
    setEditing(f.key);
    setNote(f.current?.note ?? "");
    setEnabled(f.current?.enabled ?? true);
    setSuggestionId(undefined);
    setFormError(null);
  }

  async function save(feature: string) {
    setBusy("save");
    setFormError(null);
    const res = await fetch("/api/admin/guide/ai-guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, note, enabled, suggestionId, changeNote: suggestionId ? CONSULTANT_NOTE : undefined }),
    });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setFormError(d.error ?? "That did not save.");
    showToast(`Saved as version ${d.version}.`, "success");
    setEditing(null);
    setSuggestionId(undefined);
    load();
    onChanged();
  }

  async function restore(feature: string, version: number) {
    setBusy(`restore-${feature}-${version}`);
    const res = await fetch("/api/admin/guide/ai-guidance/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature, version }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast(`Version ${version} is back, saved as version ${d.version}.`, "success");
    load();
  }

  async function suggest(feature: string) {
    setBusy(`suggest-${feature}`);
    const res = await fetch("/api/admin/guide/consultant/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature, goal: goal[feature] ?? "" }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast("Claude's suggested note is below.", "success");
    onChanged();
  }

  if (error) return <ErrorState message="Could not load the AI features." onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <h3 className="font-display text-base font-semibold text-brand-ink">Train the AI features</h3>
        <p className="text-sm text-gray-700">Give each AI feature a short note on how you want it to sound and what to emphasise. The note is added <span className="font-semibold">after</span> the feature&apos;s own fixed rules, so it can adjust tone and context but can never loosen a safeguard, give out answers or change marks. Every change is a new version you can bring back.</p>
        <details className="text-sm text-gray-700">
          <summary className="cursor-pointer font-semibold text-brand-ink">What cannot be trained, and why</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {data.notTrainable.map((n) => <li key={n.label}><span className="font-semibold">{n.label}.</span> {n.why}</li>)}
          </ul>
        </details>
      </Card>

      <ul className="space-y-3">
        {data.features.map((f) => (
          <li key={f.key}>
            <Card className="space-y-3" data-feature={f.key}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink">{f.label}</p>
                  <p className="break-words text-xs text-gray-600">{f.where}</p>
                </div>
                <Badge variant={f.current?.enabled ? "success" : "neutral"}>{f.current ? (f.current.enabled ? `Guidance on · v${f.current.version}` : `Guidance off · v${f.current.version}`) : "No guidance"}</Badge>
              </div>

              {editing === f.key ? (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(f.key); }}>
                  {suggestionId && <p className="rounded-lg bg-brand-goldLight px-3 py-2 text-sm text-brand-goldText">Suggested by the Claude consultant. Read it, change anything, and only then save. The feature uses nothing until you do.</p>}
                  <Textarea label={`Guidance for ${f.label}`} value={note} onChange={(e) => setNote(e.target.value)} rows={5} maxLength={data.noteMax} error={formError} hint={`${note.trim().length}/${data.noteMax}. For example: ${f.example}`} />
                  <Toggle checked={enabled} label="Use this guidance" onChange={setEnabled} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => { setEditing(null); setSuggestionId(undefined); }}>Cancel</Button>
                    <Button type="submit" size="sm" loading={busy === "save"}>Save as a new version</Button>
                  </div>
                </form>
              ) : (
                <>
                  {f.current ? <p className="whitespace-pre-line break-words rounded-xl bg-brand-sand p-3 text-sm text-brand-ink">{f.current.note}</p> : <p className="text-sm text-gray-600">This feature uses only its built-in rules.</p>}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => edit(f)}>{f.current ? "Edit guidance" : "Write guidance"}</Button>
                  </div>
                </>
              )}

              {ready && editing !== f.key && (
                <div className="space-y-2 border-t border-gray-200 pt-3">
                  <Textarea label="Ask Claude to suggest a note (optional goal)" value={goal[f.key] ?? ""} onChange={(e) => setGoal((g) => ({ ...g, [f.key]: e.target.value }))} rows={2} maxLength={600} placeholder={f.example} />
                  <Button size="sm" variant="secondary" onClick={() => suggest(f.key)} loading={busy === `suggest-${f.key}`} disabled={!!busy}>Suggest a note</Button>
                </div>
              )}

              {f.versions.length > 1 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-gray-700">History ({f.versions.length} versions)</summary>
                  <ul className="mt-2 space-y-2">
                    {f.versions.map((v) => (
                      <li key={v.version} className="rounded-lg border border-gray-200 p-2">
                        <p className="text-xs text-gray-600">v{v.version} · {dateTime(v.createdAt)}{v.changedByName ? ` · ${v.changedByName}` : ""}{v.enabled ? "" : " · off"}{v.changeNote ? ` · ${v.changeNote}` : ""}</p>
                        <p className="mt-1 whitespace-pre-line break-words text-sm text-brand-ink">{v.note || "(empty)"}</p>
                        {v.version !== f.current?.version && <Button size="sm" variant="secondary" className="mt-1" onClick={() => restore(f.key, v.version)} loading={busy === `restore-${f.key}-${v.version}`}>Bring this back</Button>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
