"use client";
import { useEffect, useRef, useState } from "react";
import ArenaFrame from "./ArenaFrame";
import { useArenaLive } from "./useArenaLive";
import { CHEER_EMOJI } from "@/lib/arena/spectateCore";
import type { SpectateView } from "@/lib/arena/spectate";

type Served = NonNullable<SpectateView["round"]>["served"];
const labels = "ABCDEFGH";

/** What the players are looking at, as plain text and lists. */
function servedLines(s: Served): { prompt: string; items: string[]; ordered?: boolean } {
  if (!s) return { prompt: "", items: [] };
  if (s.format === "QUIZ") return { prompt: s.question, items: s.options.map((o) => o.text) };
  if (s.format === "MATCHING") return { prompt: s.prompt, items: [...s.lefts.map((l) => `${l}  ↔`), ...s.rights] };
  if (s.format === "ORDERING") return { prompt: s.prompt, items: s.steps };
  return { prompt: s.situation, items: s.options };
}

function answerLine(a: NonNullable<SpectateView["reveal"]>["answer"]): string {
  if (a.correctText) return a.correctText;
  if (a.pairs?.length) return a.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ");
  if (a.correctOrder?.length) return a.correctOrder.map((t, i) => `${i + 1}. ${t}`).join("  ");
  return a.best ?? "";
}

/** Watching a live match: the score, the clock and the question, with emoji cheers. The answer shows only when the round is revealed. */
export default function ArenaWatch({ matchId }: { matchId: string }) {
  const { data: v, error, serverNow } = useArenaLive<SpectateView>(`/api/arena/matches/${matchId}/watch`, { listen: [], pollMs: 1500 });
  const [flying, setFlying] = useState<{ id: string; e: string; x: number }[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!v) return;
    if (seen.current === null) { seen.current = new Set(v.cheers.map((c) => c.id)); return; }
    for (const c of v.cheers) {
      if (seen.current.has(c.id)) continue;
      seen.current.add(c.id);
      const item = { id: c.id, e: CHEER_EMOJI[c.kind] ?? "👏", x: 10 + Math.random() * 75 };
      setFlying((f) => [...f, item]);
      setTimeout(() => setFlying((f) => f.filter((x) => x.id !== item.id)), 1500);
    }
  }, [v]);
  useEffect(() => {
    const end = v?.phaseEndsAt ?? null;
    if (end === null) { setLeft(null); return; }
    const t = () => setLeft(Math.max(0, end - serverNow()));
    t(); const id = setInterval(t, 250);
    return () => clearInterval(id);
  }, [v?.phaseEndsAt, serverNow]);

  async function cheer(kind: string) {
    const e = CHEER_EMOJI[kind];
    setFlying((f) => [...f, { id: `me-${Date.now()}`, e, x: 10 + Math.random() * 75 }]);
    const res = await fetch(`/api/arena/matches/${matchId}/cheer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setToast(j.error ?? "That didn't send."); setTimeout(() => setToast(null), 3000); }
  }

  const back = v ? `/trainee/arena/${v.courseId}` : "/trainee/arena";
  if (!v) return <ArenaFrame title="Watching" backHref={back}><div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>{error ? error.message : "Opening the match…"}</div></div></ArenaFrame>;
  const lines = servedLines(v.round?.served ?? null);
  const over = v.status === "COMPLETED" || v.status === "FORFEITED";
  const turnName = v.round ? (v.round.answerer === "a" ? v.a.name : v.b.name).split(" ")[0] : null;
  const Side = ({ p }: { p: SpectateView["a"] }) => <div className="ar-side"><span className="ar-av">{p.initials}</span><b>{p.name.split(" ")[0]}</b>{p.tier && p.tierKey && <span className={`ar-tier ar-t-${p.tierKey.toLowerCase()}`}>{p.tier}</span>}<span className="ar-score">{p.score}</span></div>;
  return (
    <ArenaFrame title={`Watching · ${v.a.name.split(" ")[0]} vs ${v.b.name.split(" ")[0]}`} backHref={back}>
      <div className="ar-stage">
        <div className="ar-in ar-watch">
          <div className="ar-top"><div className="ar-t">{over ? "Match over" : v.status === "ACTIVE" ? `Question ${v.roundNo} of ${v.totalRounds}` : "Starting soon"}</div><span className="ar-pill" data-testid="watching">👁 {v.watching} watching</span></div>
          <div className="ar-wbody">
            <div className="ar-vs"><Side p={v.a} /><div className="ar-wtimer" aria-label="Time left">{over ? "🏁" : left === null ? "–" : Math.ceil(left / 1000)}</div><Side p={v.b} /></div>
            {over && v.result && <div className="ar-card ar-wres"><div className="ar-big">{v.result.winner === "draw" ? "It's a draw" : `${(v.result.winner === "a" ? v.a : v.b).name} wins!`}</div></div>}
            {!over && v.round && (
              <div className="ar-card" data-testid="watch-question">
                <p className="ar-sub">{turnName} is {v.round.stage === "STEAL" ? "stealing" : "answering"} · worth {v.round.points} points</p>
                <p className="ar-name">{lines.prompt}</p>
                <div className="ar-fopts">{lines.items.map((t, i) => <div key={i} className="ar-fopt" style={{ cursor: "default" }}>{v.round!.served && (v.round!.served as { format: string }).format !== "ORDERING" ? <b>{labels[i]}</b> : <b>{i + 1}</b>} {t}</div>)}</div>
                {v.reveal && <p className="ar-note ar-ok" data-testid="watch-answer">Answer: {answerLine(v.reveal.answer)}</p>}
              </div>
            )}
            {!over && !v.round && <div className="ar-card"><p className="ar-muted">Waiting for the next question…</p></div>}
            <div className="ar-floaty" aria-hidden>{flying.map((f) => <span key={f.id} style={{ left: `${f.x}%` }}>{f.e}</span>)}</div>
            <div className="ar-glass">
              <span className="ar-muted">Cheer them on. Cheers are emoji only; nothing you do changes the match.</span>
              <div className="ar-cheers">{Object.entries(CHEER_EMOJI).map(([k, e]) => <button key={k} type="button" aria-label={k} onClick={() => void cheer(k)}>{e}</button>)}</div>
            </div>
          </div>
        </div>
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}
