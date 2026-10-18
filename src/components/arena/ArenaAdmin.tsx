"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ARENA_SETTING_LABELS, RULE_LIMITS, bonusPoints, type ArenaAvailable, type ArenaRow, type ArenaSettings, type ArenaSpectatorMode } from "@/lib/arena/configCore";

type ScopeType = "PLATFORM" | "ORGANIZATION" | "COURSE";
interface Payload {
  scopeType: ScopeType;
  scopeId: string;
  own: ArenaRow;
  inherited: ArenaSettings;
  effective: ArenaSettings;
  available: ArenaAvailable;
  realtime: "ably" | "poll";
  organizations: { id: string; name: string }[];
  courses: { id: string; title: string }[];
}

const SPECTATOR_LABEL: Record<ArenaSpectatorMode, string> = { OFF: "Off", ENROLLED: "Enrolled only", LIVE: "Live event: whole platform" };

/** Super Admin: the Gaming Arena switches and rules, for the whole platform, one organization or one course. */
export default function ArenaAdmin() {
  const { showToast } = useToast();
  const [scopeType, setScopeType] = useState<ScopeType>("PLATFORM");
  const [scopeId, setScopeId] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/arena?scopeType=${scopeType}&scopeId=${encodeURIComponent(scopeId)}`);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Could not load the arena settings.");
    setData(await res.json());
  }, [scopeType, scopeId]);
  useEffect(() => { void load(); }, [load]);

  async function change(patch: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/admin/arena", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scopeType, scopeId, patch }) });
    setBusy(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) return showToast(body?.error ?? "Could not save that change.", "error");
    setData((d) => (d ? { ...d, ...body } : d));
    showToast("Saved.");
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/admin/arena/test", { method: "POST" });
    setTesting(false);
    setTest(res.ok ? await res.json() : { ok: false, message: "The test could not run." });
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;

  const s = data.effective;
  const own = data.own;
  const wide = scopeType !== "PLATFORM";
  const key = <K extends keyof ArenaSettings>(k: K) => k;

  const Source = ({ k }: { k: keyof ArenaSettings }) =>
    !wide ? null : own[k] !== null && own[k] !== undefined ? (
      <span className="flex items-center gap-2 text-xs text-gray-600">Set here <button type="button" className="font-semibold text-brand-teal underline" onClick={() => change({ [k]: null })}>Use the wider setting</button></span>
    ) : (
      <span className="text-xs text-gray-600">Using the wider setting</span>
    );

  const SwitchRow = ({ k, title, hint, disabled, note }: { k: "enabled" | "gameEnabled" | "chatEnabled" | "ladderEnabled"; title: string; hint: string; disabled?: boolean; note?: string }) => (
    <div className="flex items-start justify-between gap-4 border-t border-brand-gray py-3 first:border-t-0">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-brand-ink">{title}</h3>
        <p className="text-sm text-gray-600">{hint}</p>
        {note && <p className="mt-1 text-xs font-semibold text-brand-goldText">{note}</p>}
        <Source k={k} />
      </div>
      <Toggle checked={!!s[k]} disabled={busy || disabled} label={title} onChange={(v) => change({ [k]: v })} />
    </div>
  );

  const NumRow = ({ k, title, hint, unit }: { k: keyof typeof RULE_LIMITS; title: string; hint: string; unit?: string }) => {
    const lim = RULE_LIMITS[k];
    return (
      <div className="flex items-start justify-between gap-4 border-t border-brand-gray py-3 first:border-t-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-ink">{title}</h3>
          <p className="text-sm text-gray-600">{hint}</p>
          {k === "bonusPercent" && <p className="mt-1 text-xs text-gray-700">Example: an 80-point question is worth {bonusPoints(80, s.bonusPercent)} points as a bonus.</p>}
          <Source k={k} />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
          <input
            key={`${k}-${s[k]}-${scopeType}-${scopeId}`}
            type="number"
            inputMode="numeric"
            min={lim.min}
            max={lim.max}
            defaultValue={s[k] as number}
            aria-label={title}
            disabled={busy}
            className="w-24 rounded-lg border border-brand-gray bg-brand-surface px-2 py-1.5 text-sm text-brand-ink"
            onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== s[k]) void change({ [k]: n }); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          />
          {unit}
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Where these settings apply" className="inline-flex rounded-full border border-brand-gray p-0.5">
            {(["PLATFORM", "ORGANIZATION", "COURSE"] as ScopeType[]).map((t) => (
              <button key={t} type="button" aria-pressed={scopeType === t} onClick={() => { setScopeType(t); setScopeId(""); setData(null); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${scopeType === t ? "bg-brand-action text-white" : "text-gray-700 hover:bg-brand-mint"}`}>
                {t === "PLATFORM" ? "Whole platform" : t === "ORGANIZATION" ? "One organization" : "One course"}
              </button>
            ))}
          </div>
          {scopeType === "ORGANIZATION" && (
            <select aria-label="Organization" value={scopeId} onChange={(e) => { setScopeId(e.target.value); setData(null); }} className="rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink">
              <option value="">Choose an organization</option>
              {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {scopeType === "COURSE" && (
            <select aria-label="Course" value={scopeId} onChange={(e) => { setScopeId(e.target.value); setData(null); }} className="rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink">
              <option value="">Choose a course</option>
              {data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
        </div>
        {wide && !scopeId ? (
          <p className="text-sm text-gray-600">Choose {scopeType === "ORGANIZATION" ? "an organization" : "a course"} to change its settings. Anything you leave alone follows the wider setting.</p>
        ) : (
          <p className="text-sm text-gray-600">Right now the arena is <strong>{data.available.arena ? "on" : "off"}</strong> here{data.available.arena ? `: the game is ${data.available.game ? "on" : "off"}, spectators ${SPECTATOR_LABEL[data.available.spectators].toLowerCase()}.` : "."}</p>
        )}
      </Card>

      {(!wide || scopeId) && (
        <>
          <Card className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-brand-ink">Switches</h2>
            <SwitchRow k="enabled" title="Gaming Arena" hint="The master switch. Nothing in the arena works while it is off." />
            <SwitchRow k="gameEnabled" title="Two-player Interview game" hint="Challenges, the lobby, the match, results and rematch." disabled={!s.enabled} />
            <SwitchRow k="chatEnabled" title="Course chat" hint="A group chat for each course." />
            <SwitchRow k="ladderEnabled" title="Champion ladder" hint="Rankings, and challenging the champion." />
            <div className="flex items-start justify-between gap-4 border-t border-brand-gray py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-brand-ink">Spectators</h3>
                <p className="text-sm text-gray-600">Who may watch a match. Off by default. A live event opens watching to the whole platform for a serious event.</p>
                <p className="mt-1 text-xs font-semibold text-brand-goldText">Watching is built in a later release.</p>
                <Source k="spectators" />
              </div>
              <div role="group" aria-label="Spectators" className="inline-flex shrink-0 flex-wrap rounded-full border border-brand-gray p-0.5">
                {(Object.keys(SPECTATOR_LABEL) as ArenaSpectatorMode[]).map((m) => (
                  <button key={m} type="button" disabled aria-pressed={s.spectators === m} className={`rounded-full px-3 py-1 text-xs font-semibold opacity-60 ${s.spectators === m ? "bg-brand-action text-white" : "text-gray-700"}`}>{SPECTATOR_LABEL[m]}</button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-brand-ink">Rules of play</h2>
            <p className="text-sm text-gray-600">Instructors can also set these for their own course, from the course page. A value set on a course wins over the platform and organization.</p>
            <NumRow k="questionSeconds" title={ARENA_SETTING_LABELS.questionSeconds} hint="Default 60. Counts down on every question." unit="seconds" />
            <NumRow k="pickSeconds" title={ARENA_SETTING_LABELS.pickSeconds} hint="Default 180. Players are not shown a timer when picking a number; this only stops a match from stalling if someone walks away." unit="seconds" />
            <NumRow k="bonusPercent" title={ARENA_SETTING_LABELS.bonusPercent} hint="When one player misses, the other gets 5 seconds to answer for the normal points plus this extra share." unit="% extra" />
            <NumRow k="pausesPerPlayer" title={ARENA_SETTING_LABELS.pausesPerPlayer} hint="Each player can pause and chat with the other." />
            <NumRow k="pauseSeconds" title={ARENA_SETTING_LABELS.pauseSeconds} hint="The game resumes by itself after this long." unit="seconds" />
            <NumRow k="questionsPerMatch" title={ARENA_SETTING_LABELS.questionsPerMatch} hint="How many questions make a full match." />
            <div className="flex items-start justify-between gap-4 border-t border-brand-gray py-3">
              <div className="min-w-0"><h3 className="text-sm font-semibold text-brand-ink">{ARENA_SETTING_LABELS.tickingSound}</h3><p className="text-sm text-gray-600">A soft tick each second on every question. Players can turn it off.</p><Source k="tickingSound" /></div>
              <Toggle checked={s.tickingSound} disabled={busy} label="Ticking sound" onChange={(v) => change({ tickingSound: v })} />
            </div>
          </Card>
        </>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink">Real-time connection</h2>
            <p className="text-sm text-gray-600">Instant updates for the game come from Ably. Without it the game still works; pages just check for changes every second or two.</p>
          </div>
          <Badge variant={data.realtime === "ably" ? "success" : "neutral"}>{data.realtime === "ably" ? "Ably key found" : "Polling mode (no key)"}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" loading={testing} onClick={runTest}>Test the connection</Button>
          {test && <p role="status" className={`text-sm ${test.ok ? "text-brand-tealDeep" : "text-brand-rose"}`}>{test.message}</p>}
        </div>
      </Card>
    </div>
  );
}
