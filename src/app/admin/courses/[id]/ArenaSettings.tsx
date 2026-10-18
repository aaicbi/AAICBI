"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import { RULE_LIMITS, bonusPoints, type ArenaAvailable, type ArenaRules } from "@/lib/arena/configCore";

interface RuleView { value: number | boolean; own: number | boolean | null; inherited: number | boolean; default: number | boolean }
interface Payload { available: ArenaAvailable; rules: Record<keyof ArenaRules, RuleView> }

const FIELDS: { key: Exclude<keyof ArenaRules, "tickingSound">; title: string; hint: string; unit?: string }[] = [
  { key: "questionSeconds", title: "Seconds per question", hint: "Default 60. Every question counts down from this.", unit: "seconds" },
  { key: "pickSeconds", title: "Longest wait for a number pick", hint: "Default 180. Players see no timer when picking; this only stops a match from stalling if someone walks away.", unit: "seconds" },
  { key: "bonusPercent", title: "Bonus for a stolen question", hint: "When one player misses, the other gets 5 seconds to answer for the normal points plus this extra share.", unit: "% extra" },
  { key: "pausesPerPlayer", title: "Pauses per player", hint: "Each player can pause and chat with the other." },
  { key: "pauseSeconds", title: "Longest pause", hint: "The game resumes by itself after this long.", unit: "seconds" },
  { key: "questionsPerMatch", title: "Questions per match", hint: "How many questions make a full match." },
];

interface Mod {
  chatOn: boolean;
  messages: { id: string; traineeId: string; name: string; body: string; at: number; removed: boolean }[];
  suspensions: { id: string; traineeId: string; name: string; reason: string | null; since: number; until: number | null; lifted: boolean; active: boolean }[];
}

/** Moderation of the course chat: remove a message, suspend a player from the arena, lift a suspension. */
function ChatModeration({ courseId, showToast }: { courseId: string; showToast: (message: string, variant?: "success" | "error") => void }) {
  const [mod, setMod] = useState<Mod | null>(null);
  const [hours, setHours] = useState(24);
  const url = `/api/admin/courses/${courseId}/arena/chat`;
  const load = useCallback(async () => { const res = await fetch(url); if (res.ok) setMod(await res.json()); }, [url]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15000); return () => clearInterval(t); }, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) return showToast(j?.error ?? "That didn't work.", "error");
    showToast(done);
    void load();
  }
  if (!mod) return null;
  const active = mod.suspensions.filter((x) => x.active);
  return (
    <div className="border-t border-brand-gray py-3" id="arena-chat-moderation">
      <h3 className="text-sm font-semibold text-brand-ink">Chat moderation</h3>
      {!mod.chatOn && <p className="text-sm text-gray-600">The course chat is off. A Super Admin switches it on.</p>}
      {active.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold uppercase text-gray-700">Suspended</p>
          {active.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">{x.name}{x.until ? ` until ${new Date(x.until).toLocaleString()}` : ""}{x.reason ? ` · ${x.reason}` : ""}</span>
              <button type="button" className="shrink-0 text-xs font-semibold text-brand-teal underline" onClick={() => act({ action: "lift", suspensionId: x.id }, "Suspension lifted.")}>Lift</button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
        <label>Suspend for <input type="number" min={1} max={2160} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} aria-label="Suspension hours" className="mx-1 w-16 rounded-lg border border-brand-gray bg-brand-surface px-2 py-1 text-sm text-brand-ink" />hours</label>
      </div>
      <div className="mt-2 max-h-72 space-y-1 overflow-auto">
        {mod.messages.length === 0 && <p className="text-sm text-gray-600">No chat messages yet.</p>}
        {mod.messages.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg bg-brand-gray/40 px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-semibold text-brand-ink">{m.name}</span> <span className="text-xs text-gray-600">{new Date(m.at).toLocaleString()}</span>
              <p className={m.removed ? "italic text-gray-500" : "text-gray-800"} style={{ overflowWrap: "anywhere" }}>{m.removed ? "Removed" : m.body}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
              {!m.removed && <button type="button" className="text-brand-teal underline" onClick={() => act({ action: "remove", messageId: m.id }, "Message removed.")}>Remove</button>}
              <button type="button" className="text-red-700 underline" onClick={() => { if (confirm(`Suspend ${m.name} from this course's arena for ${hours} hour(s)? Their last day of messages will be hidden.`)) void act({ action: "suspend", traineeId: m.traineeId, hours, removeRecent: true }, `${m.name} suspended.`); }}>Suspend</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Sprints { on: boolean; recent: { id: string; question: string; points: number; open: boolean; winner: string | null; answers: number; at: number }[]; pool: { id: string; text: string; module: string }[] }

/** Fastest Fingers: post a question in the course chat; the first trainee with the right answer wins credits. */
function FastestFingers({ courseId, showToast }: { courseId: string; showToast: (message: string, variant?: "success" | "error") => void }) {
  const url = `/api/admin/courses/${courseId}/arena/sprint`;
  const [d, setD] = useState<Sprints | null>(null);
  const [q, setQ] = useState("");
  const [points, setPoints] = useState(10);
  const [mode, setMode] = useState<"pick" | "write">("pick");
  const [text, setText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [right, setRight] = useState(0);
  const load = useCallback(async () => { const res = await fetch(`${url}?q=${encodeURIComponent(q)}`); if (res.ok) setD(await res.json()); }, [url, q]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) return showToast(j?.error ?? "That didn't work.", "error");
    showToast(done);
    void load();
  }
  if (!d) return null;
  const open = d.recent.find((r) => r.open);
  return (
    <div className="border-t border-brand-gray py-3" id="arena-fastest-fingers">
      <h3 className="text-sm font-semibold text-brand-ink">Fastest Fingers</h3>
      {!d.on ? <p className="text-sm text-gray-600">Fastest Fingers is off. A Super Admin switches it on in the Ayakbi Arena settings.</p> : (
        <>
          <p className="text-sm text-gray-600">Post a question in the course chat. The first trainee with the right answer wins credit scores; everyone gets one try.</p>
          {open && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-brand-mint px-3 py-2 text-sm">
              <span className="min-w-0"><b>Live now:</b> {open.question} ({open.answers} answered)</span>
              <button type="button" className="shrink-0 text-xs font-semibold text-red-700 underline" onClick={() => act({ action: "close", sprintId: open.id }, "Question closed.")}>Close</button>
            </div>
          )}
          <div className="mt-3 flex gap-2 text-xs font-semibold">
            <button type="button" className={`rounded-full px-3 py-1 ${mode === "pick" ? "bg-brand-teal text-white" : "bg-brand-gray"}`} onClick={() => setMode("pick")}>Pick from the course</button>
            <button type="button" className={`rounded-full px-3 py-1 ${mode === "write" ? "bg-brand-teal text-white" : "bg-brand-gray"}`} onClick={() => setMode("write")}>Write my own</button>
            <label className="ml-auto flex items-center gap-1 font-normal text-gray-600">Credits <input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value) || 1)} aria-label="Credits for the winner" className="w-16 rounded-lg border border-brand-gray bg-brand-surface px-2 py-1 text-sm text-brand-ink" /></label>
          </div>
          {mode === "pick" ? (
            <div className="mt-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the course questions" aria-label="Search questions" className="w-full rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" />
              <div className="mt-2 max-h-64 space-y-1 overflow-auto">
                {d.pool.length === 0 && <p className="text-sm text-gray-600">No approved practice questions match.</p>}
                {d.pool.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg bg-brand-gray/40 px-3 py-2 text-sm">
                    <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>{p.text}<span className="block text-xs text-gray-500">{p.module}</span></span>
                    <button type="button" className="shrink-0 text-xs font-semibold text-brand-teal underline" onClick={() => act({ action: "start", questionId: p.id, points }, "Posted to the course chat.")}>Post</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={500} placeholder="Your question" aria-label="Question" className="w-full rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" />
              {opts.map((o, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="fastest-right" checked={right === i} onChange={() => setRight(i)} aria-label={`Answer ${"ABCD"[i]} is right`} />
                  <input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Answer ${"ABCD"[i]}${i > 1 ? " (optional)" : ""}`} maxLength={200} className="flex-1 rounded-lg border border-brand-gray bg-brand-surface px-3 py-1.5 text-sm text-brand-ink" />
                </label>
              ))}
              <button type="button" className="rounded-full bg-brand-teal px-4 py-1.5 text-sm font-semibold text-white" onClick={() => {
                const kept = opts.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
                const ci = kept.findIndex((x) => x.i === right);
                if (ci < 0) return showToast("Mark one of the answers you filled in as the right one.", "error");
                void act({ action: "start", points, custom: { text, options: kept.map((x) => x.o), correctIndex: ci } }, "Posted to the course chat.").then(() => { setText(""); setOpts(["", "", "", ""]); });
              }}>Post to the chat</button>
            </div>
          )}
          {d.recent.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold uppercase text-gray-700">Recent questions</p>
              {d.recent.map((r) => <p key={r.id} className="text-sm text-gray-700" style={{ overflowWrap: "anywhere" }}>{r.question} · {r.open ? "live" : r.winner ? `won by ${r.winner}` : "no winner"} · {r.answers} answered</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The rules of play for this course's Ayakbi Arena. A Super Admin turns the arena itself on; the course owner sets how it plays. */
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
        <h2 className="font-display text-lg font-semibold text-brand-ink">Ayakbi Arena rules</h2>
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
      <ChatModeration courseId={courseId} showToast={showToast} />
      <FastestFingers courseId={courseId} showToast={showToast} />
    </Card>
  );
}
