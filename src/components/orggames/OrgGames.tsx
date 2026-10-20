"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { SWITCH_LABEL, ORG_SWITCH_KEYS, type OrgSwitchKey } from "@/lib/orggames/core";

interface Overview {
  organization: string; courses: Array<{ id: string; title: string }>; cohorts: Array<{ id: string; name: string; courseId: string }>; games: Array<{ id: string; title: string; format: string }>;
  can: string[]; policy: Record<string, boolean>; stats: { trainees: number; activeNow: number; openReports: number; escalated: number };
}
interface Player { userId: string; name: string; email: string; sources: string[]; games: number; answers: number; correct: number; accuracy: number; averageScore: number }
interface Match { id: string; courseId: string; course: string; a: string; b: string; aId: string; bId: string; status: string; scoreA: number; scoreB: number; round: number; startedAt: number; paused: boolean; flags: string[] }
interface Feed {
  reports: Array<{ id: string; courseId: string; course: string; matchId: string; reason: string; note: string | null; status: string; reporter: string | null; reported: string | null; reportedId: string | null; at: number; handledNote: string | null }>;
  restrictions: Array<{ id: string; courseId: string; course: string; traineeId: string; name: string; reason: string | null; since: number; until: number | null; lifted: boolean; active: boolean }>;
  history: Array<{ id: string; kind: string; label: string; reason: string; trainee: string | null; by: string | null; at: number; escalated: boolean; resolved: boolean }>;
}
interface ChatGames {
  recent: Array<{ id: string; courseId: string; by: string; traineeId: string | null; body: string; at: number }>;
  sprints: Array<{ id: string; courseId: string; course: string; question: string; status: string; winner: string | null; answers: number; points: number; at: number }>;
  challenges: Array<{ id: string; course: string; from: string | null; text: string; at: number }>;
  removed: Array<{ id: string; by: string; reason: string | null; at: number }>;
}
interface Settings { courses: Array<{ id: string; title: string; switches: Record<string, { on: boolean; platformAllows: boolean }>; rules: Record<string, { value: number | boolean; default: number | boolean }> }>; canToggle: boolean; canSetRules: boolean }

const TABS = [["results", "Results"], ["live", "Live games"], ["moderation", "Moderation"], ["chat", "Group chat games"], ["settings", "Settings"], ["history", "History"]] as const;
type Tab = (typeof TABS)[number][0];
const when = (t: number) => new Date(t).toLocaleString();
const chip = "min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-50";

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

/**
 * The Games section of a training organization: results for its own trainees, live games, moderation, course group chat games and the settings the Super Admin lets it change.
 * It is not the Game Studio and has none of its tools. Every action asks for a reason that is kept with the decision.
 */
export default function OrgGames() {
  const { showToast } = useToast();
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("results");
  const can = useMemo(() => new Set(ov?.can ?? []), [ov]);

  const loadOverview = useCallback(async () => {
    const r = await api<Overview>("/api/org/games/overview");
    if (!r.ok) { setError(r.status === 403 ? "Your account cannot open the Games section." : "Games could not be loaded."); return; }
    setOv(r.data); setError(null);
  }, []);
  useEffect(() => { void loadOverview(); }, [loadOverview]);

  // One dialog asks for the reason for every action, so every decision is recorded with one.
  const [ask, setAsk] = useState<{ title: string; confirm: string; extra?: React.ReactNode; run: (reason: string) => Promise<string | null> } | null>(null);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const decide = (title: string, confirm: string, run: (reason: string) => Promise<string | null>, extra?: React.ReactNode) => { setReason(""); setAskError(null); setAsk({ title, confirm, run, extra }); };
  async function submitAsk() {
    if (!ask) return;
    setAsking(true);
    const err = await ask.run(reason);
    setAsking(false);
    if (err) { setAskError(err); return; }
    setAsk(null); showToast("Done and recorded."); void loadOverview();
  }

  if (error) return <ErrorState message={error} onRetry={loadOverview} />;
  if (!ov) return <SkeletonList rows={3} />;

  return (
    <div data-testid="org-games" className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4" data-testid="org-games-stats">
        {([["Trainees", ov.stats.trainees], ["Games live now", ov.stats.activeNow], ["Open reports", ov.stats.openReports], ["With AAICBI", ov.stats.escalated]] as const).map(([l, n]) => (
          <Card key={l}><p className="text-xs font-semibold uppercase text-gray-600">{l}</p><p className="font-display text-2xl font-semibold text-brand-ink">{n}</p></Card>
        ))}
      </div>
      <div role="tablist" aria-label="Games" className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} data-testid={`tab-${k}`} className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${tab === k ? "bg-brand-action text-brand-onAccent" : "border border-brand-gray text-brand-ink hover:bg-brand-mint"}`}>{l}</button>)}
      </div>

      {tab === "results" && <Results ov={ov} can={can} />}
      {tab === "live" && <Live can={can} policy={ov.policy} decide={decide} />}
      {tab === "moderation" && <Moderation can={can} policy={ov.policy} decide={decide} />}
      {tab === "chat" && <Chat ov={ov} can={can} decide={decide} />}
      {tab === "settings" && <SettingsTab can={can} />}
      {tab === "history" && <HistoryTab />}

      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask?.title ?? ""} size="md">
        <div className="space-y-3" data-testid="reason-dialog">
          {ask?.extra}
          <Textarea label="Reason (kept with the decision)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} data-testid="reason-input" />
          {askError && <p role="alert" className="text-sm text-brand-rose" data-testid="reason-error">{askError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submitAsk()} loading={asking} data-testid="reason-confirm">{ask?.confirm}</Button>
            <Button variant="secondary" onClick={() => setAsk(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type Decide = (title: string, confirm: string, run: (reason: string) => Promise<string | null>, extra?: React.ReactNode) => void;

async function post<T>(url: string, body: unknown): Promise<{ err: string | null; data: T }> {
  const r = await api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { err: r.ok ? null : r.data.error ?? "That did not work.", data: r.data };
}

/* ------------------------------------------------------------ results */
function Results({ ov, can }: { ov: Overview; can: Set<string> }) {
  const [courseId, setCourseId] = useState(""); const [cohortId, setCohortId] = useState(""); const [gameId, setGameId] = useState(""); const [q, setQ] = useState(""); const [days, setDays] = useState("");
  const [rows, setRows] = useState<Player[] | null>(null);
  const [summary, setSummary] = useState<{ players: number; answers: number; accuracy: number } | null>(null);
  const [detail, setDetail] = useState<{ name: string; plays: Array<{ at: string; game: string; what: string; correct: boolean }> } | null>(null);
  const [board, setBoard] = useState<{ ladder: Array<{ rank: number; name: string; rating: number; wins: number; losses: number }>; credits: Array<{ rank: number; name: string; points: number }> } | null>(null);
  const qs = useMemo(() => new URLSearchParams({ ...(courseId ? { courseId } : {}), ...(cohortId ? { cohortId } : {}), ...(gameId ? { gameId } : {}), ...(q ? { q } : {}), ...(days ? { days } : {}) }).toString(), [courseId, cohortId, gameId, q, days]);
  useEffect(() => {
    let live = true;
    api<{ players: Player[]; summary: { players: number; answers: number; accuracy: number } }>(`/api/org/games/results?${qs}`).then((r) => { if (live && r.ok) { setRows(r.data.players); setSummary(r.data.summary); } });
    return () => { live = false; };
  }, [qs]);
  useEffect(() => { setBoard(null); if (!courseId) return; api<NonNullable<typeof board>>(`/api/org/games/leaderboard?courseId=${courseId}`).then((r) => r.ok && setBoard(r.data)); }, [courseId]);
  async function open(p: Player) {
    const r = await api<{ plays: Array<{ at: string; game: string; what: string; correct: boolean }> }>(`/api/org/games/results/player?traineeId=${p.userId}`);
    if (r.ok) setDetail({ name: p.name, plays: r.data.plays });
  }
  return (
    <div className="space-y-4" data-testid="results-panel">
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setCohortId(""); }} data-testid="f-course"><option value="">All courses</option>{ov.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
          <Select label="Cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)} data-testid="f-cohort"><option value="">All cohorts</option>{ov.cohorts.filter((c) => !courseId || c.courseId === courseId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select label="Game" value={gameId} onChange={(e) => setGameId(e.target.value)} data-testid="f-game"><option value="">All games</option>{ov.games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select>
          <Input label="Trainee" value={q} onChange={(e) => setQ(e.target.value)} placeholder="name or email" data-testid="f-trainee" />
          <Select label="Date" value={days} onChange={(e) => setDays(e.target.value)} data-testid="f-days"><option value="">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
          {can.has("org_games.results:export") && <div className="flex items-end"><a className={`${chip} inline-flex items-center`} href={`/api/org/games/results/export?${qs}`} data-testid="export">Download spreadsheet</a></div>}
        </div>
      </Card>
      {summary && <p className="text-sm text-brand-ink" data-testid="results-summary">{summary.players} player{summary.players === 1 ? "" : "s"} · {summary.answers} answers · {summary.accuracy}% right overall.</p>}
      {rows === null ? <SkeletonList rows={3} /> : rows.length === 0 ? <Card><p className="text-sm text-brand-ink" data-testid="results-empty">No game activity for these filters yet.</p></Card> : (
        <ul className="space-y-2" data-testid="results-list">
          {rows.map((p) => (
            <li key={p.userId}>
              <button type="button" className="w-full rounded-2xl border border-brand-gray bg-brand-surface p-3 text-left hover:border-brand-teal" onClick={() => void open(p)} data-testid="player-row">
                <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-brand-ink">{p.name}</span><span className="text-xs text-gray-700">{p.games} game{p.games === 1 ? "" : "s"} · {p.answers} answers · {p.correct} right · {p.accuracy}% · average {p.averageScore}%</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {board && (
        <Card><div data-testid="leaderboard">
          <h3 className="font-semibold text-brand-ink">Leaderboards for this course</h3>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-semibold uppercase text-gray-600">Ladder</p>{board.ladder.length === 0 ? <p className="text-sm text-gray-700">No ranked games yet.</p> : <ol className="text-sm text-brand-ink">{board.ladder.map((r) => <li key={r.rank}>{r.rank}. {r.name}: {r.rating} ({r.wins}W {r.losses}L)</li>)}</ol>}</div>
            <div><p className="text-xs font-semibold uppercase text-gray-600">Fastest Fingers credits</p>{board.credits.length === 0 ? <p className="text-sm text-gray-700">No credits yet.</p> : <ol className="text-sm text-brand-ink">{board.credits.map((r) => <li key={r.rank}>{r.rank}. {r.name}: {r.points}</li>)}</ol>}</div>
          </div>
        </div></Card>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name}: latest answers` : ""} size="lg">
        <ul className="space-y-1 text-sm text-brand-ink" data-testid="player-detail">{detail?.plays.length === 0 ? <li>No answers yet.</li> : detail?.plays.map((p, i) => <li key={i}>{p.correct ? "✓" : "✗"} {p.game}: {p.what}</li>)}</ul>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------ live */
function Live({ can, policy, decide }: { can: Set<string>; policy: Record<string, boolean>; decide: Decide }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const load = useCallback(async () => { const r = await api<{ matches: Match[] }>("/api/org/games/live"); if (r.ok) setMatches(r.data.matches); }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15000); return () => clearInterval(t); }, [load]);
  if (!matches) return <SkeletonList rows={2} />;
  if (!can.has("org_games.live:view")) return <Card><p className="text-sm text-brand-ink">Watching live games is not switched on for your organization.</p></Card>;
  return (
    <div className="space-y-2" data-testid="live-panel">
      {matches.length === 0 && <Card><p className="text-sm text-brand-ink" data-testid="live-empty">No games are being played by your trainees right now.</p></Card>}
      {matches.map((m) => (
        <Card key={m.id}>
          <div data-testid="live-row" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-brand-ink">{m.a} vs {m.b}</p><div className="flex flex-wrap gap-1"><Badge variant="neutral">{m.status}{m.paused ? " · paused" : ""}</Badge>{m.flags.map((f) => <Badge key={f} variant="warning">{f}</Badge>)}</div></div>
            <p className="text-xs text-gray-700">{m.course} · round {m.round} · {m.scoreA} to {m.scoreB} · started {when(m.startedAt)}</p>
            <div className="flex flex-wrap gap-2">
              {can.has("org_games.sessions:moderate") && policy.endSessions && <button type="button" className={chip} data-testid="end-session" onClick={() => decide("End this game?", "End the game", async (reason) => (await post("/api/org/games/moderation", { action: "endSession", courseId: m.courseId, matchId: m.id, reason })).err)}>End session</button>}
              {can.has("org_games.restrictions:manage") && policy.removeParticipants && [[m.a, m.aId], [m.b, m.bId]].map(([n, tid]) => <button key={tid} type="button" className={chip} data-testid="remove-participant" onClick={() => decide(`Remove ${n} from this game?`, "Remove", async (reason) => (await post("/api/org/games/moderation", { action: "removeParticipant", courseId: m.courseId, matchId: m.id, traineeId: tid, reason })).err, <p className="text-sm text-gray-700">The game ends for both players and {n} is kept out of this course&apos;s games for 24 hours unless you lift it.</p>)}>Remove {n}</button>)}
            </div>
          </div>
        </Card>
      ))}
      <button type="button" className={chip} onClick={() => void load()}>Refresh</button>
    </div>
  );
}

/* ------------------------------------------------------------ moderation */
function Moderation({ can, policy, decide }: { can: Set<string>; policy: Record<string, boolean>; decide: Decide }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const load = useCallback(async () => { const r = await api<Feed>("/api/org/games/moderation"); if (r.ok) setFeed(r.data); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!feed) return <SkeletonList rows={2} />;
  const act = (body: Record<string, unknown>) => async (reason: string) => { const r = await post("/api/org/games/moderation", { ...body, reason, note: reason }); if (!r.err) await load(); return r.err; };
  const open = feed.reports.filter((r) => r.status === "OPEN");
  return (
    <div className="space-y-4" data-testid="moderation-panel">
      <section><h3 className="font-semibold text-brand-ink">Open reports ({open.length})</h3>
        <ul className="mt-2 space-y-2">
          {open.length === 0 && <li><Card><p className="text-sm text-brand-ink" data-testid="no-reports">Nothing is waiting for a decision.</p></Card></li>}
          {open.map((r) => (
            <li key={r.id}><Card><div data-testid="report-row" className="space-y-2">
              <p className="font-semibold text-brand-ink">{r.reason} · {r.course}</p>
              <p className="text-sm text-gray-800">{r.reporter ?? "A trainee"} reported {r.reported ?? "a game"}{r.note ? `: “${r.note}”` : ""} · {when(r.at)}</p>
              <div className="flex flex-wrap gap-2">
                {can.has("org_games.reports:moderate") && <>
                  <button type="button" className={chip} data-testid="resolve-report" onClick={() => decide("Resolve this report", "Resolve", act({ action: "decide", courseId: r.courseId, reportId: r.id, decision: "resolve" }))}>Resolve</button>
                  <button type="button" className={chip} data-testid="dismiss-report" onClick={() => decide("Dismiss this report", "Dismiss", act({ action: "decide", courseId: r.courseId, reportId: r.id, decision: "dismiss" }))}>Dismiss</button>
                  {r.reportedId && <button type="button" className={chip} data-testid="warn" onClick={() => decide(`Warn ${r.reported}`, "Send warning", act({ action: "warn", courseId: r.courseId, traineeId: r.reportedId }))}>Warn {r.reported}</button>}
                  <button type="button" className={chip} data-testid="escalate" onClick={() => decide("Escalate to AAICBI", "Escalate", act({ action: "escalate", courseId: r.courseId, matchId: r.matchId, traineeId: r.reportedId }), <p className="text-sm text-gray-700">A Super Admin is told and takes it from here. The case stays on your history until they close it.</p>)}>Escalate to AAICBI</button>
                </>}
                {can.has("org_games.restrictions:manage") && policy.restrictTrainees && r.reportedId && <button type="button" className={chip} data-testid="restrict" onClick={() => decide(`Pause ${r.reported}'s participation`, "Pause for 24 hours", act({ action: "restrict", courseId: r.courseId, traineeId: r.reportedId, hours: 24 }))}>Pause {r.reported} for 24 hours</button>}
              </div>
            </div></Card></li>
          ))}
        </ul>
      </section>
      <section><h3 className="font-semibold text-brand-ink">Restrictions</h3>
        <ul className="mt-2 space-y-2" data-testid="restrictions">
          {feed.restrictions.filter((x) => x.active).length === 0 && <li><Card><p className="text-sm text-brand-ink">Nobody is restricted right now.</p></Card></li>}
          {feed.restrictions.filter((x) => x.active).map((x) => (
            <li key={x.id}><Card><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-brand-ink"><strong>{x.name}</strong> · {x.course} · {x.until ? `until ${when(x.until)}` : "until lifted"}{x.reason ? ` · ${x.reason}` : ""}</p>
              {can.has("org_games.restrictions:manage") && <button type="button" className={chip} data-testid="lift" onClick={() => decide(`Lift ${x.name}'s restriction`, "Lift it", act({ action: "lift", courseId: x.courseId, suspensionId: x.id }))}>Lift</button>}</div></Card></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ group chat games */
function Chat({ ov, can, decide }: { ov: Overview; can: Set<string>; decide: Decide }) {
  const [courseId, setCourseId] = useState(ov.courses[0]?.id ?? "");
  const [data, setData] = useState<ChatGames | null>(null);
  const load = useCallback(async () => { const r = await api<ChatGames>(`/api/org/games/chat-games?courseId=${courseId}`); if (r.ok) setData(r.data); }, [courseId]);
  useEffect(() => { setData(null); if (courseId) void load(); }, [courseId, load]);
  const act = (body: Record<string, unknown>) => async (reason: string) => { const r = await post<ChatGames>("/api/org/games/chat-games", { ...body, reason }); if (!r.err) setData(r.data); return r.err; };
  const mod = can.has("org_games.chat_games:moderate");
  return (
    <div className="space-y-4" data-testid="chat-panel">
      <Card><Select label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)} data-testid="chat-course">{ov.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Card>
      {!data ? <SkeletonList rows={2} /> : (
        <>
          <section><h3 className="font-semibold text-brand-ink">Fastest Fingers games</h3>
            <ul className="mt-2 space-y-2" data-testid="sprints">
              {data.sprints.length === 0 && <li><Card><p className="text-sm text-brand-ink">No Fastest Fingers games in this course yet.</p></Card></li>}
              {data.sprints.map((s) => <li key={s.id}><Card><div data-testid="sprint-row" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-brand-ink"><strong>{s.question}</strong><br />{s.status === "OPEN" ? "Open" : `Closed${s.winner ? `, won by ${s.winner}` : ""}`} · {s.answers} answer{s.answers === 1 ? "" : "s"} · {s.points} points</p>
                {mod && s.status === "OPEN" && <button type="button" className={chip} data-testid="close-game" onClick={() => decide("Stop this game?", "Stop the game", act({ action: "closeGame", courseId, sprintId: s.id }))}>Stop this game</button>}</div></Card></li>)}
            </ul>
          </section>
          <section><h3 className="font-semibold text-brand-ink">Challenges started in the chat</h3>
            <ul className="mt-2 space-y-1 text-sm text-brand-ink" data-testid="challenges">{data.challenges.length === 0 ? <li>None yet.</li> : data.challenges.map((c) => <li key={c.id}>{when(c.at)}: {c.text}</li>)}</ul>
          </section>
          <section><h3 className="font-semibold text-brand-ink">Recent chat messages</h3>
            <ul className="mt-2 space-y-2" data-testid="recent-messages">
              {data.recent.length === 0 && <li className="text-sm text-brand-ink">No recent messages.</li>}
              {data.recent.map((m) => <li key={m.id}><Card><div data-testid="message-row" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-brand-ink"><strong>{m.by}</strong>: {m.body}</p>
                {mod && <button type="button" className={chip} data-testid="remove-message" onClick={() => decide("Remove this message?", "Remove it", act({ action: "removeMessage", courseId, messageId: m.id }))}>Remove</button>}</div></Card></li>)}
            </ul>
          </section>
          {data.removed.length > 0 && <section><h3 className="font-semibold text-brand-ink">Recently removed</h3><ul className="mt-2 space-y-1 text-sm text-gray-800">{data.removed.map((m) => <li key={m.id}>{when(m.at)}: a message by {m.by}{m.reason ? ` removed (${m.reason})` : " removed"}</li>)}</ul></section>}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ settings */
function SettingsTab({ can }: { can: Set<string> }) {
  const { showToast } = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await api<Settings>("/api/org/games/settings"); if (r.ok) setS(r.data); }, []);
  useEffect(() => { void load(); }, [load]);
  async function put(courseId: string, body: Record<string, unknown>) {
    setBusy(true);
    const r = await api<Settings>("/api/org/games/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, ...body }) });
    setBusy(false);
    if (!r.ok) { showToast(r.data.error ?? "That did not save.", "error"); return; }
    setS(r.data); showToast("Saved.");
  }
  if (!s) return <SkeletonList rows={2} />;
  const configure = can.has("org_games.settings:configure");
  return (
    <div className="space-y-3" data-testid="settings-panel">
      <p className="text-sm text-gray-700">You can only change what AAICBI allows for your organization. Global game settings and the Game Studio are not available to training organizations.</p>
      {s.courses.length === 0 && <Card><p className="text-sm text-brand-ink">You have no courses yet.</p></Card>}
      {s.courses.map((c) => (
        <Card key={c.id}><div data-testid="settings-course" className="space-y-2">
          <p className="font-semibold text-brand-ink">{c.title}</p>
          {ORG_SWITCH_KEYS.map((k: OrgSwitchKey) => {
            const sw = c.switches[k];
            return <Checkbox key={k} label={SWITCH_LABEL[k]} hint={!sw.platformAllows ? "The platform has this switched off." : undefined} checked={sw.on} disabled={busy || !configure || !s.canToggle || (!sw.platformAllows && !sw.on)} onChange={(e) => void put(c.id, { switches: { [k]: e.target.checked } })} data-testid={`sw-${k}`} />;
          })}
          {!s.canToggle && <p className="text-xs text-gray-600" data-testid="no-toggle">Switching games on or off is not enabled for your organization.</p>}
          {s.canSetRules && configure && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input label="Seconds per question" type="number" min={5} max={120} defaultValue={Number(c.rules.questionSeconds?.value ?? 20)} onBlur={(e) => void put(c.id, { rules: { questionSeconds: Number(e.target.value) } })} data-testid="rule-seconds" />
            </div>
          )}
        </div></Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ history */
function HistoryTab() {
  const [feed, setFeed] = useState<Feed | null>(null);
  useEffect(() => { api<Feed>("/api/org/games/moderation").then((r) => r.ok && setFeed(r.data)); }, []);
  if (!feed) return <SkeletonList rows={2} />;
  return (
    <ul className="space-y-2" data-testid="history-list">
      {feed.history.length === 0 && <li><Card><p className="text-sm text-brand-ink">No moderation decisions yet.</p></Card></li>}
      {feed.history.map((h) => <li key={h.id}><Card><div data-testid="history-row"><p className="text-sm font-semibold text-brand-ink">{h.label}{h.trainee ? `: ${h.trainee}` : ""}{h.escalated ? (h.resolved ? " (closed by AAICBI)" : " (with AAICBI)") : ""}</p><p className="text-sm text-gray-800">{h.reason}</p><p className="text-xs text-gray-600">{h.by} · {when(h.at)}</p></div></Card></li>)}
    </ul>
  );
}
