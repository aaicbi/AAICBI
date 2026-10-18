"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import { RULE_LIMITS, bonusPoints, type ArenaAvailable, type ArenaRules } from "@/lib/arena/configCore";

interface RuleView { value: number | boolean; own: number | boolean | null; inherited: number | boolean; default: number | boolean }
interface Payload { available: ArenaAvailable; rules: Record<keyof ArenaRules, RuleView> }

const FIELDS: { key: Exclude<keyof ArenaRules, "tickingSound">; title: string; hint: string; unit?: string }[] = [
  { key: "questionSeconds", title: "Seconds per question", hint: "Default 15. Every question counts down from this.", unit: "seconds" },
  { key: "pickSeconds", title: "Seconds to pick a number", hint: "Default 10. If it runs out, the system picks a question for the player.", unit: "seconds" },
  { key: "bonusPercent", title: "Bonus for a stolen question", hint: "When one player misses, the other gets 5 seconds to answer for the normal points plus this extra share.", unit: "% extra" },
  { key: "pausesPerPlayer", title: "Pauses per player", hint: "Each player can pause and chat with the other." },
  { key: "pauseSeconds", title: "Longest pause", hint: "The game resumes by itself after this long.", unit: "seconds" },
  { key: "questionsPerMatch", title: "Questions per match", hint: "How many questions make a full match." },
];

/** The rules of play for this course's Gaming Arena. A Super Admin turns the arena itself on; the course owner sets how it plays. */
export default function ArenaSettings({ courseId, showToast }: { courseId: string; showToast: (message: string, variant?: "success" | "error") => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/courses/${courseId}/arena`);
    if (res.ok) setData(await res.json());
  }, [courseId]);
  useEffect(() => { void load(); }, [load]);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/admin/courses/${courseId}/arena`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setBusy(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) return showToast(body?.error ?? "Could not save.", "error");
    setData(body);
    showToast("Game rules saved.");
  }

  if (!data) return null;
  const r = data.rules;
  return (
    <Card className="mt-6 space-y-1" id="arena-settings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Gaming Arena rules</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${data.available.game ? "bg-brand-mint text-brand-tealDeep" : "bg-brand-gray text-gray-700"}`}>{data.available.game ? "On for this course" : "Off for this course"}</span>
      </div>
      <p className="text-sm text-gray-600">How the two-player game plays for your trainees. {data.available.game ? "" : "A Super Admin switches the arena on; you can set the rules now."}</p>
      {FIELDS.map((f) => {
        const lim = RULE_LIMITS[f.key];
        const v = r[f.key];
        return (
          <div key={f.key} className="flex items-start justify-between gap-4 border-t border-brand-gray py-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-brand-ink">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.hint}</p>
              {f.key === "bonusPercent" && <p className="mt-1 text-xs text-gray-700">Example: an 80-point question is worth {bonusPoints(80, v.value as number)} points as a bonus.</p>}
              {v.own !== null && <button type="button" className="mt-1 text-xs font-semibold text-brand-teal underline" onClick={() => save({ [f.key]: null })}>Use the usual value ({String(v.inherited)})</button>}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
              <input
                key={`${f.key}-${String(v.value)}`}
                type="number" inputMode="numeric" min={lim.min} max={lim.max} defaultValue={v.value as number} aria-label={f.title} disabled={busy}
                className="w-24 rounded-lg border border-brand-gray bg-brand-surface px-2 py-1.5 text-sm text-brand-ink"
                onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== v.value) void save({ [f.key]: n }); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
              {f.unit}
            </label>
          </div>
        );
      })}
      <div className="flex items-start justify-between gap-4 border-t border-brand-gray py-3">
        <div><h3 className="text-sm font-semibold text-brand-ink">Ticking sound</h3><p className="text-sm text-gray-600">A soft tick each second on every question. Players can turn it off.</p></div>
        <Toggle checked={!!r.tickingSound.value} disabled={busy} label="Ticking sound" onChange={(next) => save({ tickingSound: next })} />
      </div>
    </Card>
  );
}
