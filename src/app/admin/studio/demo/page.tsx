"use client";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import GameRound from "@/components/games/experience/GameRound";
import { DEMO_FORMATS, createDemoApi } from "@/components/games/demoData";
import type { PlayFormat } from "@/components/games/GamePlayer";
import { shuffle } from "@/lib/shuffle";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/studio/demo — a sample 10-question round in each game format, so staff can see and feel the learner experience
 * (welcome, countdown, animations, Loop, sounds, summary) without building anything. Nothing is saved and no XP is paid.
 */
export default function GameDemoPage() {
  const [role, setRole] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [format, setFormat] = useState<PlayFormat>("QUIZ");
  const [run, setRun] = useState(0);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRole(typeof d.role === "string" ? d.role : null))
      .catch(() => setRole(null))
      .finally(() => setChecked(true));
  }, []);

  const api = useMemo(() => createDemoApi(format, shuffle), [format, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const allowed = role === "SUPER_ADMIN";
  const info = DEMO_FORMATS.find((f) => f.format === format)!;

  if (checked && !allowed) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Game demo</p>
            <p className="mt-2 text-sm text-gray-600">The game demo is only for the Super Admin.</p>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <BackLink href="/admin/studio">Back to the Game Studio</BackLink>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Game demo</h1>
        <p className="mt-1 text-sm text-gray-700">
          Play a sample round in each format to see how it feels for trainees. Tip: answer a few right in a row to see the streak, then miss one to see how Loop
          encourages. Nothing here is saved and no XP is paid.
        </p>
        <div role="tablist" aria-label="Game format" className="mt-4 flex flex-wrap gap-2">
          {DEMO_FORMATS.map((f) => (
            <button
              key={f.format}
              type="button"
              role="tab"
              aria-selected={format === f.format}
              data-testid={`demo-tab-${f.format}`}
              onClick={() => {
                setFormat(f.format);
                setRun((n) => n + 1);
              }}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${format === f.format ? "border-brand-teal bg-brand-teal text-brand-onAccent" : "border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">{info.blurb}</p>
        <div className="mt-4">
          {allowed ? <GameRound key={`${format}-${run}`} title={`${info.label} demo`} api={api} onExit={() => setRun((n) => n + 1)} exitLabel="Start over" /> : <p className="text-sm text-gray-500">Loading…</p>}
        </div>
      </main>
    </>
  );
}
