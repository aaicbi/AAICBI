"use client";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import BackLink from "@/components/ui/BackLink";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { ADMIN_NAV } from "@/lib/admin/nav";

type Pool = "PRACTICE" | "FORMAL" | null;

interface Coverage {
  practice: number;
  formal: number;
  untagged: number;
  practiceShort: number;
  formalShort: number;
  ok: boolean;
}
interface ObjectiveDto {
  id: string;
  text: string;
  isCritical: boolean;
  coverage?: Coverage;
  questions: { id: string; text: string; pool: Pool }[];
}
interface Snapshot {
  module: { id: string; title: string; courseId: string; courseTitle: string } | null;
  settings: {
    practiceEnabled: boolean;
    practiceBeforeFormal: boolean;
    practiceRequiredPercent: number;
    enabledRewards: string[];
  };
  objectives: ObjectiveDto[];
  ready: boolean;
  minimums: { practice: number; formal: number };
  rewardOptions: { kind: string; label: string }[];
}

export default function QuestSettingsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [percent, setPercent] = useState("70");
  const { showToast } = useToast();
  const url = `/api/modules/${params.id}/quest`;

  const apply = useCallback((snap: Snapshot) => {
    setData(snap);
    setPercent(String(snap.settings.practiceRequiredPercent));
  }, []);

  useEffect(() => {
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load this module.");
        return r.json();
      })
      .then(apply)
      .catch((e: Error) => setError(e.message));
  }, [url, apply]);

  async function send(method: "PUT" | "POST", body: unknown, okMessage?: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "That didn't save. Please try again.");
      return false;
    }
    apply(json as Snapshot);
    if (okMessage) showToast(okMessage, "success");
    return true;
  }

  if (error && !data) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10 text-gray-600">{error}</main>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-3xl px-6 py-10 text-gray-500">Loading…</main>
      </>
    );
  }

  const s = data.settings;
  const untaggedTotal = data.objectives.reduce((n, o) => n + (o.coverage?.untagged ?? 0), 0);
  const criticalIds = data.objectives.filter((o) => o.isCritical).map((o) => o.id);
  const toggleCritical = (id: string, on: boolean) =>
    send("PUT", { criticalObjectiveIds: on ? [...criticalIds, id] : criticalIds.filter((c) => c !== id) });
  const toggleReward = (kind: string, on: boolean) =>
    send("PUT", { enabledRewards: on ? [...s.enabledRewards, kind] : s.enabledRewards.filter((k) => k !== kind) });

  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <DesktopRecommended what="Setting up practice and mastery" />
        {data.module && (
          <BackLink href={`/admin/modules/${params.id}/assessment`} className="text-sm text-brand-teal hover:underline">
            {data.module.title} — Assessment
          </BackLink>
        )}
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Practice and mastery</h1>
        <p className="mt-1 text-sm text-gray-700">
          Split this module&apos;s approved questions into a <strong>practice pool</strong> (trainees train on these) and a{" "}
          <strong>formal pool</strong> (used by the assessment, never shown in practice). Practice XP never counts toward a
          certificate.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-brand-roseLight px-4 py-3 text-sm text-brand-rose">
            {error}
          </p>
        )}

        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-brand-ink">1. Question pools</h2>
            {data.ready ? <Badge variant="success">Ready to go live</Badge> : <Badge variant="warning">Not ready yet</Badge>}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            To go live, every learning objective needs at least {data.minimums.practice} approved practice questions and{" "}
            {data.minimums.formal} approved formal questions. Only approved questions count.
          </p>
          {data.objectives.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">This module has no confirmed learning objectives yet. Add them in the question bank first.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.objectives.map((o) => {
                const c = o.coverage;
                return (
                  <li key={o.id} className="rounded-2xl border border-brand-gray bg-brand-surface p-3">
                    <p className="text-sm font-medium text-brand-ink">{o.text}</p>
                    {c && (
                      <p className="mt-1 text-xs text-gray-700">
                        Practice {c.practice}/{data.minimums.practice}
                        {c.practiceShort > 0 && <span className="text-brand-rose"> ({c.practiceShort} short)</span>} · Formal {c.formal}/
                        {data.minimums.formal}
                        {c.formalShort > 0 && <span className="text-brand-rose"> ({c.formalShort} short)</span>} · Not assigned {c.untagged}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <Checkbox
                        label="Required for the assessment (mastery gate)"
                        hint="A trainee can't pass unless they clear this objective, whatever their overall score."
                        checked={o.isCritical}
                        disabled={saving}
                        onChange={(e) => void toggleCritical(o.id, e.target.checked)}
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-brand-teal underline"
                      aria-expanded={open === o.id}
                      onClick={() => setOpen(open === o.id ? null : o.id)}
                    >
                      {open === o.id ? "Hide questions" : `Assign questions (${o.questions.length})`}
                    </button>
                    {open === o.id && (
                      <ul className="mt-2 space-y-2">
                        {o.questions.map((q) => (
                          <li key={q.id} className="flex flex-col gap-2 rounded-xl bg-brand-gray/20 p-2 sm:flex-row sm:items-center">
                            <p className="flex-1 text-xs text-brand-ink">{q.text}</p>
                            <Select
                              label={`Pool for: ${q.text.slice(0, 40)}`}
                              hideLabel
                              compact
                              value={q.pool ?? ""}
                              disabled={saving}
                              onChange={(e) => void send("POST", { action: "setPool", questionIds: [q.id], pool: e.target.value || null })}
                              wrapperClassName="sm:w-44"
                            >
                              <option value="">Not assigned</option>
                              <option value="PRACTICE">Practice</option>
                              <option value="FORMAL">Formal assessment</option>
                            </Select>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {untaggedTotal > 0 && (
            <div className="mt-4 rounded-2xl bg-brand-mint/40 p-3">
              <p className="text-sm text-brand-ink">
                {untaggedTotal} approved question{untaggedTotal === 1 ? " is" : "s are"} not assigned to a pool.
              </p>
              <Button
                className="mt-2"
                variant="secondary"
                size="sm"
                loading={saving}
                onClick={() => void send("POST", { action: "autoSplit" }, "Questions split between the pools.")}
              >
                Split them automatically (about 40% formal, 60% practice)
              </Button>
              <p className="mt-1 text-xs text-gray-600">You can change any question afterwards.</p>
            </div>
          )}
        </Card>

        <Card className="mt-4">
          <h2 className="text-lg font-semibold text-brand-ink">2. Practice mode</h2>
          <div className="mt-3 space-y-4">
            <Checkbox
              label="Practice is live for trainees"
              hint={data.ready ? "Trainees see a Practice button on this module." : "Locked until every objective has enough approved questions in both pools."}
              checked={s.practiceEnabled}
              disabled={saving || (!data.ready && !s.practiceEnabled)}
              onChange={(e) => void send("PUT", { practiceEnabled: e.target.checked }, e.target.checked ? "Practice is live." : "Practice is off.")}
            />
            <Checkbox
              label="Practice first: the assessment opens only after enough practice"
              hint="Checked once, when a trainee first tries to start the assessment. Off by default."
              checked={s.practiceBeforeFormal}
              disabled={saving}
              onChange={(e) => void send("PUT", { practiceBeforeFormal: e.target.checked })}
            />
            {s.practiceBeforeFormal && (
              <div className="flex flex-wrap items-end gap-3 pl-6">
                <Input
                  label="Objectives to master first (%)"
                  type="number"
                  min={10}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  wrapperClassName="w-48"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={saving}
                  onClick={() => void send("PUT", { practiceRequiredPercent: Math.max(10, Math.min(100, Number(percent) || 70)) }, "Saved.")}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="text-lg font-semibold text-brand-ink">3. Rewards in this module</h2>
          <p className="mt-1 text-xs text-gray-600">Choose which rewards trainees can earn here. Rewards never affect certificates or the assessment result.</p>
          <div className="mt-3 space-y-3">
            {data.rewardOptions.map((r) => (
              <Checkbox
                key={r.kind}
                label={r.label}
                checked={s.enabledRewards.includes(r.kind)}
                disabled={saving}
                onChange={(e) => void toggleReward(r.kind, e.target.checked)}
              />
            ))}
          </div>
        </Card>
      </main>
    </>
  );
}
