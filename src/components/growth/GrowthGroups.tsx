"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Kind = "squads" | "challenges";
interface Squad { id: string; name: string; course: string; createdAt: string; members: number; maxMembers: number; finished: number; points: number; outOf: number; captain: string; rivalOf: string | null; answeredBy: number; joinUrl: string }
interface Side { id: string | null; name: string; named: boolean; score: number }
interface Challenge { id: string; course: string; startedAt: string; finished: boolean; challenger: Side; responder: Side; outcome: "WIN" | "LOSE" | "TIE" | null }
interface Data {
  kind: Kind; page: number; pages: number; total: number;
  summary: { squads: number; inSquads: number; challenges: number; finishedChallenges: number };
  campaigns: { id: string; title: string }[];
  rows: unknown[];
}

const OUTCOME: Record<string, { text: string; variant: "success" | "danger" | "neutral" }> = { WIN: { text: "Beat the challenger", variant: "success" }, LOSE: { text: "Lost to the challenger", variant: "danger" }, TIE: { text: "Tied", variant: "neutral" } };
const btn = "min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60";

/** Super Admin: every squad and friend challenge, with rename, remove and clear-name tools. */
export default function GrowthGroups() {
  const { showToast } = useToast();
  const [kind, setKind] = useState<Kind>("squads");
  const [campaign, setCampaign] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams({ kind, page: String(page) });
    if (campaign) p.set("campaign", campaign);
    if (kind === "squads" && query) p.set("q", query);
    const res = await fetch(`/api/admin/growth/groups?${p}`);
    if (!res.ok) { setError("The list could not be loaded."); return; }
    setData(await res.json());
    setError(null);
  }, [kind, page, campaign, query]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/admin/growth/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(json.error ?? "That did not work."); return; }
    setEditing(null);
    showToast(done);
    await load();
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;
  const s = data.summary;
  const stat = (k: string, v: number) => <div key={k} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3"><p className="font-display text-xl font-semibold text-brand-ink">{v}</p><p className="text-sm text-gray-600">{k}</p></div>;

  return (
    <div className="space-y-5" data-testid="growth-groups">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Squads", s.squads)}{stat("Plays inside squads", s.inSquads)}{stat("Friend challenges answered", s.challenges)}{stat("Of those, finished", s.finishedChallenges)}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Show" className="flex gap-2">
          {(["squads", "challenges"] as Kind[]).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} data-testid={`tab-${k}`} onClick={() => { setKind(k); setPage(1); setData(null); }} className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${kind === k ? "bg-brand-action text-brand-onAccent" : "border border-brand-gray text-brand-ink hover:bg-brand-mint"}`}>{k === "squads" ? "Squads" : "Challenges"}</button>
          ))}
        </div>
        <label className="block text-sm"><span className="font-semibold text-brand-ink">Course</span>
          <select data-testid="campaign-filter" className="mt-1 block min-h-[44px] rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(1); }}>
            <option value="">All courses</option>
            {data.campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        {kind === "squads" && (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); setPage(1); }}>
            <label className="block text-sm"><span className="font-semibold text-brand-ink">Squad name</span><input data-testid="squad-search" className="mt-1 block min-h-[44px] w-44 rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <button type="submit" className={btn}>Search</button>
          </form>
        )}
      </div>
      {problem && <p className="text-sm text-brand-rose" role="alert">{problem}</p>}

      {data.rows.length === 0 ? (
        <Card><p className="text-sm text-brand-ink">{kind === "squads" ? "No squads yet. A squad appears when someone finishes the taster and starts one." : "No friend challenges yet. One appears when someone plays the same five questions from a friend's challenge link."}</p></Card>
      ) : kind === "squads" ? (
        <ul className="space-y-3" data-testid="squad-list">
          {(data.rows as Squad[]).map((r) => (
            <li key={r.id} className="rounded-2xl border border-brand-gray/60 bg-brand-surface p-4" data-testid="squad-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {editing === r.id ? (
                    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void act({ action: "rename", squadId: r.id, name }, "Squad renamed."); }}>
                      <input autoFocus data-testid="rename-input" aria-label={`New name for ${r.name}`} className="min-h-[44px] w-48 rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
                      <button type="submit" disabled={busy} className={btn} data-testid="rename-save">Save</button>
                      <button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : (
                    <h3 className="break-words font-display text-base font-semibold text-brand-ink [overflow-wrap:anywhere]">{r.name}</h3>
                  )}
                  <p className="mt-0.5 text-sm text-gray-600">{r.course} · started {new Date(r.createdAt).toLocaleDateString()} · captain {r.captain}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className={btn} onClick={() => { setEditing(r.id); setName(r.name); }}>Rename</button>
                  <button type="button" disabled={busy} className="min-h-[44px] rounded-full border border-brand-rose px-4 text-sm font-semibold text-brand-rose hover:bg-brand-roseLight disabled:opacity-60" onClick={() => { if (window.confirm(`Remove the squad "${r.name}"? Its members keep their scores but no longer count for a squad.`)) void act({ action: "remove", squadId: r.id }, "Squad removed."); }}>Remove</button>
                </div>
              </div>
              <p className="mt-2 text-sm text-brand-ink">{r.members} of {r.maxMembers} members · {r.finished} finished · {r.points} of {r.outOf} points</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {r.rivalOf && <Badge variant="neutral">Answering {r.rivalOf}</Badge>}
                {r.answeredBy > 0 && <Badge variant="gold">{r.answeredBy} rival squad{r.answeredBy === 1 ? "" : "s"}</Badge>}
                <span className="break-all">{r.joinUrl}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3" data-testid="challenge-list">
          {(data.rows as Challenge[]).map((r) => (
            <li key={r.id} className="rounded-2xl border border-brand-gray/60 bg-brand-surface p-4" data-testid="challenge-row">
              <p className="text-sm text-gray-600">{r.course} · {new Date(r.startedAt).toLocaleString()}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([["Challenger", r.challenger], ["Answered by", r.responder]] as const).map(([label, side]) => (
                  <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-brand-mint/40 p-3">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase text-gray-600">{label}</p><p className="break-words font-semibold text-brand-ink [overflow-wrap:anywhere]">{side.name} <span className="font-normal text-gray-600">· {side.score}/5</span></p></div>
                    {side.named && side.id && <button type="button" disabled={busy} className={btn} onClick={() => void act({ action: "clearName", playId: side.id }, "Name cleared.")}>Clear name</button>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm">{r.outcome ? <Badge variant={OUTCOME[r.outcome].variant}>{OUTCOME[r.outcome].text}</Badge> : <Badge variant="warning">Not finished</Badge>}</p>
            </li>
          ))}
        </ul>
      )}

      {data.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" className={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <p className="text-sm text-gray-600">Page {data.page} of {data.pages} · {data.total} in all</p>
          <button type="button" className={btn} disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
