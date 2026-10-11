"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { dateTime } from "@/components/admin/guide/shared";

interface Signal { area: string; severity: "info" | "watch" | "action"; title: string; detail: string; href?: string }
interface Choice { id: string; title: string; modules: Array<{ id: string; title: string; materials: number }> }

const AREA: Record<string, string> = { analytics: "Analytics", materials: "Lesson materials", assessments: "Assessments", performance: "Performance" };
const SEV = { action: ["danger", "Act"], watch: ["warning", "Watch"], info: ["neutral", "Note"] } as const;

/**
 * What the platform's numbers say right now. The signals are plain rules over
 * aggregate counts: free, instant and available even with the consultant off.
 * Asking Claude for a report or a materials review is a separate button that
 * needs the switch on, and only ever returns advice.
 */
export default function MonitorPanel({ ready, onChanged }: { ready: boolean; onChanged: () => void }) {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [at, setAt] = useState("");
  const [error, setError] = useState(false);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState<"report" | "materials" | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [courseId, setCourseId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(false);
    setSignals(null);
    fetch(`/api/admin/guide/consultant/signals?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setSignals(d.signals); setAt(d.generatedAt); })
      .catch(() => setError(true));
  }, [days]);
  useEffect(load, [load]);
  useEffect(() => {
    fetch("/api/admin/guide/consultant/materials").then((r) => (r.ok ? r.json() : null)).then((d) => d && setChoices(d.courses)).catch(() => {});
  }, []);

  async function ask(kind: "report" | "materials") {
    setBusy(kind);
    const res = await fetch(`/api/admin/guide/consultant/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "report" ? { days: Number(days) } : { moduleId }) });
    setBusy(null);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast(kind === "report" ? "Claude's report is below." : "Claude's review of the materials is below.", "success");
    onChanged();
  }

  const course = choices.find((c) => c.id === courseId);
  const shown = signals ? (showAll ? signals : signals.slice(0, 6)) : [];

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">What the numbers say</h3>
            <p className="text-xs text-gray-600">Analytics, lesson materials, assessments and performance, checked by simple rules. Counts only: no trainee is named. Free, and works even when the consultant is off.{at && ` Updated ${dateTime(at)}.`}</p>
          </div>
          <div className="w-40">
            <Select label="Period" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
          </div>
        </div>
        {error ? (
          <ErrorState message="Could not read the platform's numbers." onRetry={load} />
        ) : signals === null ? (
          <SkeletonList rows={3} />
        ) : signals.length === 0 ? (
          <p className="rounded-lg bg-brand-mint px-3 py-2 text-sm text-brand-ink">Nothing stands out. There is either not enough activity yet to judge, or everything looks healthy.</p>
        ) : (
          <>
            <ul className="space-y-2" data-testid="signals">
              {shown.map((s, i) => (
                <li key={i} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={SEV[s.severity][0]}>{SEV[s.severity][1]}</Badge>
                    <Badge variant="neutral">{AREA[s.area] ?? s.area}</Badge>
                    <p className="min-w-0 break-words text-sm font-semibold text-brand-ink">{s.title}</p>
                  </div>
                  <p className="mt-1 break-words text-sm text-gray-700">{s.detail}</p>
                  {s.href && <Link href={s.href} className="mt-1 inline-block text-sm font-semibold text-brand-teal underline">Look at it</Link>}
                </li>
              ))}
            </ul>
            {signals.length > 6 && <Button size="sm" variant="secondary" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${signals.length}`}</Button>}
          </>
        )}
      </Card>

      {ready ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">Ask Claude for a report</h3>
              <p className="text-xs text-gray-600">Claude reads the same numbers and writes what is going well, what needs attention and what to try. It cannot change anything.</p>
            </div>
            <Button size="sm" onClick={() => ask("report")} loading={busy === "report"} disabled={!!busy}>Write the report</Button>
          </div>
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-brand-ink">Review a module&apos;s lesson materials</h3>
            <p className="text-xs text-gray-600">Claude reads the Word documents in one module and points out what is unclear, missing or inconsistent. Videos, slides and PDFs cannot be read yet.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setModuleId(""); }}>
                <option value="">Choose a course</option>
                {choices.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
              <Select label="Module" value={moduleId} onChange={(e) => setModuleId(e.target.value)} disabled={!course}>
                <option value="">Choose a module</option>
                {course?.modules.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.materials} material{m.materials === 1 ? "" : "s"})</option>)}
              </Select>
            </div>
            <Button size="sm" variant="secondary" onClick={() => ask("materials")} loading={busy === "materials"} disabled={!!busy || !moduleId}>Review these materials</Button>
          </div>
        </Card>
      ) : (
        <p className="rounded-lg bg-brand-mint px-3 py-2 text-sm text-brand-ink">Switch the Claude consultant on (and make sure a key is set up) to ask it for a report or a materials review. The signals above keep working either way.</p>
      )}
    </div>
  );
}
