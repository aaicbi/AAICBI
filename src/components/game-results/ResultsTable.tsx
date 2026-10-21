"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Gamepad2, Search, Target, Trophy, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { PLAYER_KIND_LABEL, RESULT_FORMATS, type PlayerRow, type ResultFormat, type ResultsSummary } from "@/lib/quest/resultsCore";
import ExpandSelect from "@/components/ui/ExpandSelect";

interface GameOption { id: string; title: string; format: string }
interface RecentPlay { at: string; source: "COURSE" | "FEED"; game: string; format: ResultFormat; what: string; correct: boolean; score: number }
type Row = Omit<PlayerRow, "first" | "last"> & { first: string | null; last: string | null };

const FORMAT_LABEL: Record<ResultFormat, string> = { QUIZ: "Quiz", MATCHING: "Match", ORDERING: "Order", SCENARIO: "Scenario" };
const FORMAT_TONE: Record<ResultFormat, string> = { QUIZ: "bg-brand-teal/15 text-brand-teal", MATCHING: "bg-brand-gold/25 text-brand-goldText", ORDERING: "bg-brand-green/20 text-brand-green", SCENARIO: "bg-brand-rose/15 text-brand-rose" };
const tone = (pct: number) => (pct >= 70 ? "bg-brand-green" : pct >= 40 ? "bg-brand-gold" : "bg-brand-rose");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

function Stat({ icon: I, label, value, accent }: { icon: typeof Users; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-brand-gray bg-brand-surface p-3">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}><I className="h-5 w-5" aria-hidden="true" /></span>
      <p className="mt-2 text-2xl font-extrabold text-brand-ink" data-testid="stat-value">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
    </div>
  );
}

/** The players table: who has played, how many answers, how well, where, and (open a row) their latest answers. */
export default function ResultsTable({ onForbidden }: { onForbidden: (message: string) => void }) {
  const [days, setDays] = useState("30");
  const [gameId, setGameId] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<ResultsSummary | null>(null);
  const [games, setGames] = useState<GameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecentPlay[] | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (days !== "all") p.set("days", days);
    if (gameId) p.set("gameId", gameId);
    if (q.trim()) p.set("q", q.trim());
    return p;
  }, [days, gameId, q]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/game-results?${params}`);
    if (res.status === 403) {
      onForbidden((await res.json().catch(() => ({}))).error ?? "You don't have access to this table.");
      return;
    }
    if (res.ok) {
      const j = await res.json();
      setRows(j.players);
      setSummary(j.summary);
      setGames(j.games);
    }
    setLoading(false);
  }, [params, onForbidden]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function toggle(userId: string) {
    if (open === userId) return setOpen(null);
    setOpen(userId);
    setDetail(null);
    const res = await fetch(`/api/admin/game-results/${encodeURIComponent(userId)}`);
    setDetail(res.ok ? (await res.json()).plays : []);
  }

  const csv = `/api/admin/game-results?${new URLSearchParams([...params.entries(), ["format", "csv"]])}`;

  return (
    <div data-testid="results-table-wrap">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Players" value={String(summary?.players ?? 0)} accent="bg-brand-teal/15 text-brand-teal" />
        <Stat icon={Gamepad2} label="Active, last 7 days" value={String(summary?.activeLast7Days ?? 0)} accent="bg-brand-gold/25 text-brand-goldText" />
        <Stat icon={Target} label="Answers given" value={String(summary?.answers ?? 0)} accent="bg-brand-rose/15 text-brand-rose" />
        <Stat icon={Trophy} label="Overall accuracy" value={`${summary?.accuracy ?? 0}%`} accent="bg-brand-green/20 text-brand-green" />
      </div>

      <Card className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search players" className="min-h-[44px] w-full rounded-full border border-brand-gray bg-brand-surface pl-9 pr-3 text-sm text-brand-ink" data-testid="results-search" />
          </div>
          <ExpandSelect compact value={days} onChange={(e) => setDays(e.target.value)} aria-label="Period" className="min-h-[44px] rounded-full border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink" data-testid="results-days">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </ExpandSelect>
          <ExpandSelect compact value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label="Game" className="min-h-[44px] max-w-full rounded-full border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink sm:max-w-[16rem]" data-testid="results-game">
            <option value="">All games</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </ExpandSelect>
          <a href={csv} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-brand-action px-4 text-sm font-semibold text-brand-action hover:bg-brand-mint" data-testid="results-csv"><Download className="h-4 w-4" aria-hidden="true" />CSV</a>
        </div>

        {loading && rows.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-4"><EmptyState title="No games played yet" description="Players appear here after they answer a question in a game. Try a wider period or another game." /></div>
        ) : (
          <ul className="mt-4 divide-y divide-brand-gray" aria-label="Players" data-testid="results-list">
            <li className="hidden grid-cols-[minmax(0,2.2fr)_0.8fr_0.6fr_0.7fr_1.4fr_1.1fr_24px] items-center gap-3 px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-600 md:grid" aria-hidden="true">
              <span>Player</span><span>Where</span><span>Games</span><span>Answers</span><span>Accuracy</span><span>Last played</span><span />
            </li>
            {rows.map((r) => (
              <li key={r.userId} data-testid="results-row" data-user={r.userId}>
                <button type="button" onClick={() => void toggle(r.userId)} aria-expanded={open === r.userId} className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-3 text-left hover:bg-brand-mint/40 md:grid-cols-[minmax(0,2.2fr)_0.8fr_0.6fr_0.7fr_1.4fr_1.1fr_24px]">
                  <span className="col-span-2 min-w-0 md:col-span-1">
                    <span className="block truncate text-sm font-semibold text-brand-ink">{r.name}</span>
                    <span className="block truncate text-xs text-gray-600">{r.email || "No email"} · {PLAYER_KIND_LABEL[r.kind] ?? r.kind}</span>
                  </span>
                  <span className="flex flex-wrap gap-1 text-[11px] font-bold">
                    {r.sources.map((s) => <span key={s} className={`rounded-full px-2 py-0.5 ${s === "FEED" ? "bg-brand-gold/25 text-brand-goldText" : "bg-brand-teal/15 text-brand-teal"}`}>{s === "FEED" ? "Feed" : "Course"}</span>)}
                  </span>
                  <span className="text-sm text-brand-ink"><span className="md:hidden text-xs text-gray-600">Games </span>{r.games}</span>
                  <span className="text-sm text-brand-ink"><span className="md:hidden text-xs text-gray-600">Answers </span>{r.answers}</span>
                  <span className="flex items-center gap-2" aria-label={`Accuracy ${r.accuracy} percent`}>
                    <span className="h-2.5 w-full max-w-[110px] overflow-hidden rounded-full bg-brand-gray/60"><span className={`block h-full rounded-full ${tone(r.accuracy)}`} style={{ width: `${r.accuracy}%` }} /></span>
                    <span className="w-10 text-sm font-bold text-brand-ink" data-testid="results-accuracy">{r.accuracy}%</span>
                  </span>
                  <span className="text-xs text-gray-700">{when(r.last)}</span>
                  <ChevronDown className={`hidden h-4 w-4 text-gray-500 transition-transform md:block ${open === r.userId ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {open === r.userId && (
                  <div className="gx-rise mb-3 rounded-2xl bg-brand-mint/40 p-3" data-testid="results-detail">
                    <div className="flex flex-wrap gap-1.5">
                      {RESULT_FORMATS.filter((f) => r.byFormat[f].answers > 0).map((f) => (
                        <span key={f} className={`rounded-full px-2.5 py-1 text-xs font-bold ${FORMAT_TONE[f]}`}>{FORMAT_LABEL[f]}: {Math.round((r.byFormat[f].correct / r.byFormat[f].answers) * 100)}% of {r.byFormat[f].answers}</span>
                      ))}
                      <span className="rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold text-brand-ink">Average score {r.averageScore}%</span>
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-gray-600">Latest answers</p>
                    {detail === null ? <p className="mt-1 text-sm text-gray-600">Loading…</p> : detail.length === 0 ? <p className="mt-1 text-sm text-gray-600">Nothing to show.</p> : (
                      <ul className="mt-1 space-y-1.5">
                        {detail.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 rounded-xl bg-brand-surface px-3 py-2 text-sm">
                            <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${d.correct ? "bg-brand-green" : d.score > 0 ? "bg-brand-gold" : "bg-brand-rose"}`} aria-label={d.correct ? "Correct" : d.score > 0 ? "Partly right" : "Not quite"} />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-brand-ink">{d.what}</span>
                              <span className="block text-xs text-gray-600">{FORMAT_LABEL[d.format]} · {d.game} · {d.source === "FEED" ? "Feed" : "Course"} · {when(d.at)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
