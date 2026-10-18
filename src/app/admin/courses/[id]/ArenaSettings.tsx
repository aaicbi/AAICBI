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
              <button type="button" className="text-brand-rose underline" onClick={() => { if (confirm(`Suspend ${m.name} from this course's arena for ${hours} hour(s)? Their last day of messages will be hidden.`)) void act({ action: "suspend", traineeId: m.traineeId, hours, removeRecent: true }, `${m.name} suspended.`); }}>Suspend</button>
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
              <button type="button" className="shrink-0 text-xs font-semibold text-brand-rose underline" onClick={() => act({ action: "close", sprintId: open.id }, "Question closed.")}>Close</button>
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

interface LadderAdmin { on: boolean; players: { id: string; name: string; rating: number; tier: string; matches: number; hidden: boolean }[] }

/** The champion ladder: see the players and take one off the ladder (or put them back). Their rating is kept. */
function LadderPlayers({ courseId, showToast }: { courseId: string; showToast: (message: string, variant?: "success" | "error") => void }) {
  const url = `/api/admin/courses/${courseId}/arena/ladder`;
  const [d, setD] = useState<LadderAdmin | null>(null);
  const load = useCallback(async () => { const res = await fetch(url); if (res.ok) setD(await res.json()); }, [url]);
  useEffect(() => { void load(); }, [load]);
  async function act(traineeId: string, action: "hide" | "show") {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, traineeId }) });
    const j = await res.json().catch(() => null);
    if (!res.ok) return showToast(j?.error ?? "That didn't work.", "error");
    setD(j); showToast(action === "hide" ? "Taken off the ladder." : "Back on the ladder.");
  }
  if (!d) return null;
  return (
    <div className="border-t border-brand-gray py-3" id="arena-ladder-players">
      <h3 className="text-sm font-semibold text-brand-ink">Champion ladder</h3>
      {!d.on && <p className="text-sm text-gray-600">The ladder is off. A Super Admin switches it on in the Ayakbi Arena settings.</p>}
      {d.players.length === 0 ? <p className="text-sm text-gray-600">No one has played a counted match yet.</p> : (
        <div className="mt-2 max-h-72 space-y-1 overflow-auto">
          {d.players.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-brand-gray/40 px-3 py-2 text-sm">
              <span className="min-w-0"><b className="text-brand-ink">{p.name}</b> <span className="text-xs text-gray-600">{p.tier} · {p.rating} · {p.matches} match{p.matches === 1 ? "" : "es"}{p.hidden ? " · off the ladder" : ""}</span></span>
              <button type="button" className="shrink-0 text-xs font-semibold text-brand-teal underline" onClick={() => act(p.id, p.hidden ? "show" : "hide")}>{p.hidden ? "Put back" : "Take off"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EventsAdmin { on: boolean; events: { id: string; name: string; status: string; players: number; round: number; totalRounds: number; at: number }[] }

/** Live events: open an arena night for the course, start the knockout, open the big screen, cancel it. */
function LiveEvents({ courseId, showToast }: { courseId: string; showToast: (message: string, variant?: "success" | "error") => void }) {
  const url = `/api/admin/courses/${courseId}/arena/events`;
  const [d, setD] = useState<EventsAdmin | null>(null);
  const [name, setName] = useState("");
  const [qs, setQs] = useState(10);
  const load = useCallback(async () => { const res = await fetch(url); if (res.ok) setD(await res.json()); }, [url]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 10000); return () => clearInterval(t); }, [load]);
  async function act(body: Record<string, unknown>, done: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) return showToast(j?.error ?? "That didn't work.", "error");
    setD(j); showToast(done);
  }
  if (!d) return null;
  const open = d.events.find((e) => e.status === "SIGNUP" || e.status === "LIVE");
  return (
    <div className="border-t border-brand-gray py-3" id="arena-live-events">
      <h3 className="text-sm font-semibold text-brand-ink">Live events</h3>
      {!d.on ? <p className="text-sm text-gray-600">Live events are off. A Super Admin switches them on in the Ayakbi Arena settings.</p> : (
        <>
          <p className="text-sm text-gray-600">Run an arena night: players join, you start it, and the system pairs them in a knockout. Winners go through until there is a champion. Everyone else can watch.</p>
          {open ? (
            <div className="mt-2 rounded-lg bg-brand-mint px-3 py-2 text-sm" data-testid="open-event">
              <p><b>{open.name}</b> · {open.status === "SIGNUP" ? `signing up · ${open.players} joined` : `running · round ${open.round} of ${open.totalRounds}`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {open.status === "SIGNUP" && <button type="button" className="rounded-full bg-brand-teal px-4 py-1.5 text-xs font-semibold text-white" onClick={() => act({ action: "start", eventId: open.id }, "The event has started.")}>Start the event</button>}
                <a className="rounded-full border border-brand-gray bg-brand-surface px-4 py-1.5 text-xs font-semibold text-brand-ink" href={`/admin/courses/${courseId}/arena-event/${open.id}`} target="_blank" rel="noreferrer">Open the big screen</a>
                <button type="button" className="rounded-full border border-red-400 bg-brand-surface px-4 py-1.5 text-xs font-semibold text-brand-rose" onClick={() => act({ action: "cancel", eventId: open.id }, "The event was cancelled.")}>Cancel the event</button>
              </div>
            </div>
          ) : (
            <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void act({ action: "create", name, questionsPerMatch: qs }, "The event is open for sign-up.").then(() => setName("")); }}>
              <label className="min-w-0 flex-1 text-xs text-gray-600">Event name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Cyber Quiz Night" className="mt-1 w-full rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" /></label>
              <label className="text-xs text-gray-600">Questions per match<input type="number" min={4} max={30} value={qs} onChange={(e) => setQs(Number(e.target.value) || 10)} className="mt-1 block w-24 rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" /></label>
              <button type="submit" disabled={!name.trim()} className="rounded-full bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Open for sign-up</button>
            </form>
          )}
          {d.events.filter((e) => e !== open).length > 0 && <div className="mt-3 space-y-1"><p className="text-xs font-semibold uppercase text-gray-700">Earlier events</p>{d.events.filter((e) => e !== open).map((e) => <p key={e.id} className="text-sm text-gray-700">{e.name} · {e.status === "DONE" ? "finished" : e.status === "CANCELLED" ? "cancelled" : e.status.toLowerCase()} · {e.players} players</p>)}</div>}
        </>
      )}
    </div>
  );
}

interface ModOverview {
  reports: { id: string; matchId: string; reason: string; note: string | null; status: string; reporter: string | null; reported: string | null; reportedId: string | null; at: number; handledNote: string | null }[];
  matches: { id: string; a: string; b: string; status: string; scoreA: number; scoreB: number; voided: boolean; endReason: string | null; at: number; event: boolean }[];
}
interface MatchLog { a: string; b: string; messages: { id: string; from: "a" | "b"; body: string; at: number; removed: boolean }[]; reactions: number }

/** Game moderation: reports from players and watchers, live and recent matches, the chat inside a match, and what a moderator can do about them. */
function GameModeration({ courseId, showToast }: { courseId: string; showToast: (message: string, variant?: "success" | "error") => void }) {
  const url = `/api/admin/courses/${courseId}/arena/moderation`;
  const [d, setD] = useState<ModOverview | null>(null);
  const [log, setLog] = useState<{ matchId: string; data: MatchLog } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [opts, setOpts] = useState({ endMatchNow: false, voidResult: false, suspend: false });
  const load = useCallback(async () => { const res = await fetch(url); if (res.ok) setD(await res.json()); }, [url]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15000); return () => clearInterval(t); }, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (!res.ok) return showToast(j?.error ?? "That didn't work.", "error");
    setD(j); showToast(done);
  }
  async function showLog(matchId: string) {
    const res = await fetch(`${url}/matches/${matchId}`);
    if (res.ok) setLog({ matchId, data: await res.json() });
  }
  if (!d) return null;
  const openReports = d.reports.filter((r) => r.status === "OPEN");
  const names = (m: { a: string; b: string }) => `${m.a} vs ${m.b}`;
  return (
    <div className="border-t border-brand-gray py-3" id="arena-moderation">
      <h3 className="text-sm font-semibold text-brand-ink">Game moderation {openReports.length > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{openReports.length} open</span>}</h3>
      <p className="text-sm text-gray-600">Reports from players and watchers, and the matches behind them. You can end a live match, take a finished result off the ladder, remove a rude message, or suspend a player.</p>
      <div className="mt-2 space-y-2" data-testid="mod-reports">
        {d.reports.length === 0 && <p className="text-sm text-gray-600">No reports yet.</p>}
        {d.reports.map((r) => (
          <div key={r.id} className={`rounded-lg px-3 py-2 text-sm ${r.status === "OPEN" ? "border border-red-500 bg-red-500/10" : "bg-brand-gray/40"}`}>
            <p><b>{r.reason}</b> · {r.reporter} reported {r.reported ?? "a match"} · <span className="text-gray-600">{new Date(r.at).toLocaleString()}</span> · <span className="font-semibold">{r.status === "OPEN" ? "open" : r.status === "DISMISSED" ? "dismissed" : "resolved"}</span></p>
            {r.note && <p className="text-gray-700" style={{ overflowWrap: "anywhere" }}>“{r.note}”</p>}
            {r.handledNote && <p className="text-xs text-gray-600">Moderator note: {r.handledNote}</p>}
            <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
              <button type="button" className="text-brand-teal underline" onClick={() => void showLog(r.matchId)}>See the match chat</button>
              {r.status === "OPEN" && <button type="button" className="text-gray-700 underline" onClick={() => act({ action: "dismiss", reportId: r.id }, "Report dismissed.")}>Dismiss</button>}
              {r.status === "OPEN" && <button type="button" className="text-brand-rose underline" onClick={() => setOpen(open === r.id ? null : r.id)}>Take action…</button>}
            </div>
            {open === r.id && (
              <div className="mt-2 grid gap-1 rounded-lg border border-brand-gray bg-brand-surface p-2 text-xs">
                <label className="flex items-center gap-2"><input type="checkbox" checked={opts.endMatchNow} onChange={(e) => setOpts({ ...opts, endMatchNow: e.target.checked })} /> End the match if it is still being played</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={opts.voidResult} onChange={(e) => setOpts({ ...opts, voidResult: e.target.checked })} /> Take the result off the ladder</label>
                {r.reportedId && <label className="flex items-center gap-2"><input type="checkbox" checked={opts.suspend} onChange={(e) => setOpts({ ...opts, suspend: e.target.checked })} /> Suspend {r.reported} from the arena for 24 hours</label>}
                <button type="button" className="mt-1 justify-self-start rounded-full bg-brand-teal px-3 py-1 font-semibold text-white" onClick={() => { void act({ action: "resolve", reportId: r.id, endMatchNow: opts.endMatchNow, voidResult: opts.voidResult, suspendHours: opts.suspend ? 24 : null }, "Report resolved."); setOpen(null); setOpts({ endMatchNow: false, voidResult: false, suspend: false }); }}>Resolve the report</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase text-gray-700">Live and recent matches</p>
      <div className="mt-1 max-h-72 space-y-1 overflow-auto" data-testid="mod-matches">
        {d.matches.length === 0 && <p className="text-sm text-gray-600">No matches yet.</p>}
        {d.matches.map((m) => {
          const live = m.status === "ACTIVE" || m.status === "LOBBY";
          const finished = m.status === "COMPLETED" || m.status === "FORFEITED";
          return (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-gray/40 px-3 py-2 text-sm">
              <span className="min-w-0"><b className="text-brand-ink">{names(m)}</b> <span className="text-xs text-gray-600">{live ? m.status === "ACTIVE" ? "live" : "in the lobby" : m.status.toLowerCase()}{m.endReason === "staff-ended" ? " (ended by a moderator)" : ""} · {m.scoreA}–{m.scoreB}{m.voided ? " · off the ladder" : ""}{m.event ? " · event" : ""}</span></span>
              <span className="flex shrink-0 gap-3 text-xs font-semibold">
                <button type="button" className="text-brand-teal underline" onClick={() => void showLog(m.id)}>Chat</button>
                {live && <button type="button" className="text-brand-rose underline" onClick={() => act({ action: "end", matchId: m.id }, "Match ended.")}>End match</button>}
                {finished && !m.voided && <button type="button" className="text-brand-rose underline" onClick={() => act({ action: "void", matchId: m.id }, "Taken off the ladder.")}>Take off ladder</button>}
              </span>
            </div>
          );
        })}
      </div>
      {log && (
        <div className="mt-3 rounded-lg border border-brand-gray bg-brand-surface p-3 text-sm" data-testid="mod-log">
          <div className="flex items-center justify-between"><b>Match chat</b><button type="button" className="text-xs font-semibold text-gray-600 underline" onClick={() => setLog(null)}>Close</button></div>
          {log.data.messages.length === 0 ? <p className="text-gray-600">Nothing was written in this match.</p> : log.data.messages.map((x) => (
            <div key={x.id} className="mt-1 flex items-start justify-between gap-3">
              <span className={x.removed ? "italic text-gray-500" : ""} style={{ overflowWrap: "anywhere" }}><b>{x.from === "a" ? "Player 1" : "Player 2"}:</b> {x.removed ? "removed" : x.body}</span>
              {!x.removed && <button type="button" className="shrink-0 text-xs font-semibold text-brand-rose underline" onClick={async () => { await act({ action: "removeMessage", matchId: log.matchId, messageId: x.id }, "Message removed."); await showLog(log.matchId); }}>Remove</button>}
            </div>
          ))}
        </div>
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
      <LadderPlayers courseId={courseId} showToast={showToast} />
      <LiveEvents courseId={courseId} showToast={showToast} />
      <GameModeration courseId={courseId} showToast={showToast} />
    </Card>
  );
}
