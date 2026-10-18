"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ArenaFrame from "./ArenaFrame";
import { useArenaLive, channels } from "./useArenaLive";
import { chime, pickTick, tick } from "./sound";
import type { MatchView } from "@/lib/arena/arenaView";
import type { Reveal, ServedRound } from "@/lib/arena/arenaPool";

const EMOJI: Record<string, { e: string; l: string }> = {
  applause: { e: "👏", l: "Applause" }, cheer: { e: "🎉", l: "Cheer" }, wow: { e: "😮", l: "Wow" }, fire: { e: "🔥", l: "On fire" }, love: { e: "❤️", l: "Love" },
  strong: { e: "💪", l: "Strong" }, nervous: { e: "😬", l: "Nervous" }, sad: { e: "😢", l: "Sad" }, laugh: { e: "😂", l: "Funny" }, thumbs: { e: "👍", l: "Nice" },
};
const QUICK = ["Good luck!", "Back in a minute", "Ready when you are", "Well played"];

function useCountdown(endsAt: number | null, serverNow: () => number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (endsAt === null) { setLeft(null); return; }
    const t = () => setLeft(Math.max(0, endsAt - serverNow()));
    t();
    const id = setInterval(t, 200);
    return () => clearInterval(id);
  }, [endsAt, serverNow]);
  return left;
}

const Avatar = ({ p, big }: { p: MatchView["me"]; big?: boolean }) => (
  <div className={`ar-av${big ? " ar-lg" : ""}`} aria-hidden>{p.avatarUrl ? <img src={p.avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : p.initials}</div>
);

export default function ArenaMatch({ matchId }: { matchId: string }) {
  const [sound, setSound] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [heroes, setHeroes] = useState<{ id: string; e: string; who: string }[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const lastScore = useRef<{ me: number; opp: number } | null>(null);
  const [bump, setBump] = useState<"me" | "opp" | null>(null);

  const { data: v, setData, error, serverNow } = useArenaLive<MatchView>(`/api/arena/matches/${matchId}`, { listen: [channels.match(matchId)] });

  // Sound preference: the player's own choice, otherwise the instructor's rule.
  useEffect(() => {
    if (!v || sound !== null) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem("arena-ticking"); } catch { /* private mode */ }
    setSound(stored === null ? v.rules.tickingSound : stored === "1");
  }, [v, sound]);
  const setSoundPref = (on: boolean) => { setSound(on); try { localStorage.setItem("arena-ticking", on ? "1" : "0"); } catch { /* ignore */ } };

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }, []);
  const act = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    try {
      const res = await fetch(`/api/arena/matches/${matchId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { flash(j.error ?? "That didn't work."); return false; }
      setData(j as MatchView);
      return true;
    } catch { flash("You seem to be offline."); return false; }
  }, [matchId, setData, flash]);

  // Reactions from either player appear large across the stage, once each.
  useEffect(() => {
    if (!v) return;
    if (seen.current === null) { seen.current = new Set(v.reactions.map((r) => r.id)); return; }
    for (const r of v.reactions) {
      if (seen.current.has(r.id)) continue;
      seen.current.add(r.id);
      const em = EMOJI[r.kind]; if (!em) continue;
      const item = { id: r.id, e: em.e, who: r.from === "me" ? "You" : v.opponent.name };
      setHeroes((h) => [...h, item]);
      setTimeout(() => setHeroes((h) => h.filter((x) => x.id !== item.id)), 2700);
    }
  }, [v]);

  // Score pop.
  useEffect(() => {
    if (!v) return;
    const prev = lastScore.current;
    lastScore.current = { me: v.me.score, opp: v.opponent.score };
    if (prev && v.me.score > prev.me) { setBump("me"); chime(); setTimeout(() => setBump(null), 600); }
    else if (prev && v.opponent.score > prev.opp) { setBump("opp"); setTimeout(() => setBump(null), 600); }
  }, [v]);

  const pausedNow = !!v?.paused;
  const endsAt = v && !pausedNow ? v.phaseEndsAt : null;
  const left = useCountdown(v?.status === "ACTIVE" ? endsAt : null, serverNow);
  const secs = left === null ? null : Math.ceil(left / 1000);
  const phase = v?.phase ?? null;
  const total = v ? (phase === "PICK" ? v.rules.pickSeconds : phase === "STEAL" ? 5 : phase === "ANSWER" ? v.rules.questionSeconds : 6) * 1000 : 1;

  // Ticking.
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!sound || secs === null || !v || v.status !== "ACTIVE" || pausedNow) return;
    if (phase !== "ANSWER" && phase !== "STEAL" && phase !== "PICK") return;
    if (lastTick.current === secs) return;
    lastTick.current = secs;
    if (secs > 0) (phase === "PICK" ? pickTick : tick)(secs <= 5);
  }, [secs, sound, phase, v, pausedNow]);

  if (error && !v) {
    return (
      <ArenaFrame title="Gaming Arena" backHref="/trainee/arena">
        <div className="ar-stage"><div className="ar-in" style={{ placeItems: "center", display: "grid" }}><p>{error.message}</p></div></div>
      </ArenaFrame>
    );
  }
  if (!v) return <ArenaFrame title="Gaming Arena" backHref="/trainee/arena"><div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center" }}>Loading the arena…</div></div></ArenaFrame>;

  const title = `${v.courseTitle}${v.topic ? ` · ${v.topic}` : ""}`;
  const back = `/trainee/arena/${v.courseId}`;
  const hot = secs !== null && secs <= 5;
  const pct = left === null ? 100 : Math.max(0, Math.min(100, (left / total) * 100));

  return (
    <ArenaFrame title={title} backHref={back} sound={!!sound} onSound={setSoundPref}>
      <div className="ar-stage">
        <div className="ar-in">
          <div className="ar-top">
            <div className="ar-t">{v.status === "ACTIVE" ? `Question ${Math.min(v.roundNo || 1, v.totalRounds)} of ${v.totalRounds}` : statusLabel(v)}</div>
            <div className="ar-prog" aria-hidden>{v.progress.map((p, i) => <i key={i} className={p === "won" ? "ar-d" : p === "lost" ? "ar-w" : p === "now" ? "ar-n" : ""} />)}</div>
            {v.status === "ACTIVE" && <span className="ar-pill">{v.me.pausesLeft} pause{v.me.pausesLeft === 1 ? "" : "s"} left</span>}
          </div>
          <div className="ar-main">
            <div className="ar-col">
              <PlayerCard p={v.me} you active={v.turn === "me"} pop={bump === "me"} phase={v.phase} />
              {v.status === "ACTIVE" && !pausedNow && secs !== null && (
                <>
                  <div className={`ar-timer${phase === "PICK" ? " ar-pick" : ""}${hot ? " ar-hot" : ""}`} style={{ ["--t" as string]: `${pct}%` }} role="timer" aria-label={`${secs} seconds left`}><span className="ar-tnum">{secs}</span></div>
                  <div className="ar-lbl">{phase === "PICK" ? "pick a number" : phase === "STEAL" ? "bonus question" : phase === "REVEAL" ? "next question" : "seconds left"}</div>
                </>
              )}
              <PlayerCard p={v.opponent} active={v.turn === "opponent"} pop={bump === "opp"} phase={v.phase} />
            </div>
            <div className="ar-col ar-mid">{center(v, act, secs)}</div>
            <div className="ar-col">
              <div className="ar-lbl">Reactions</div>
              <div className={`ar-tray${v.reactionsOpen ? "" : " ar-locked"}`}>
                {Object.entries(EMOJI).map(([k, x]) => (
                  <button key={k} type="button" className="ar-rx" disabled={!v.reactionsOpen} onClick={() => void act("react", { kind: k })} aria-label={x.l}><span className="ar-e">{x.e}</span><span className="ar-l">{x.l}</span></button>
                ))}
              </div>
              <div className="ar-rxnote">{v.reactionsOpen ? "Send a reaction" : "Reactions open between questions"}</div>
            </div>
          </div>
        </div>
        <div className="ar-fx" aria-hidden>
          {heroes.map((h) => <div key={h.id} className="ar-hero"><div className="ar-big">{h.e}</div><span className="ar-who">{h.who}</span></div>)}
        </div>
        {v.paused && v.status === "ACTIVE" && <PauseOverlay v={v} act={act} serverNow={serverNow} />}
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}

function statusLabel(v: MatchView): string {
  switch (v.status) {
    case "PENDING": return "Challenge sent";
    case "LOBBY": return "Lobby";
    case "COMPLETED": return "Match over";
    case "FORFEITED": return "Match over";
    case "DECLINED": return "Challenge declined";
    case "EXPIRED": return "Expired";
    default: return "Cancelled";
  }
}

function PlayerCard({ p, you, active, pop, phase }: { p: MatchView["me"]; you?: boolean; active: boolean; pop: boolean; phase: MatchView["phase"] }) {
  return (
    <div className="ar-glass ar-pc" style={active ? { borderColor: "var(--gold)" } : undefined}>
      <Avatar p={p} />
      <div className="ar-name">{you ? "You" : p.name}</div>
      <div className="ar-sub">{active ? "their turn to pick" : " "}</div>
      <div className={`ar-score${pop ? " ar-up" : ""}`} aria-label={`${p.score} points`}>{p.score}</div>
    </div>
  );
}

type Act = (action: string, body?: Record<string, unknown>) => Promise<boolean>;

function center(v: MatchView, act: Act, secs: number | null) {
  switch (v.status) {
    case "PENDING": return <Pending v={v} act={act} />;
    case "LOBBY": return <Lobby v={v} act={act} />;
    case "ACTIVE": return v.phase === "PICK" ? <Board v={v} act={act} /> : <Question key={`${v.round?.idx}-${v.round?.stage}`} v={v} act={act} secs={secs} />;
    case "COMPLETED": case "FORFEITED": return <Result v={v} />;
    default: return <div className="ar-glass" style={{ textAlign: "center" }}><p className="ar-name">{statusLabel(v)}</p><p className="ar-muted">Head back to the arena to start another match.</p></div>;
  }
}

function Pending({ v, act }: { v: MatchView; act: Act }) {
  const mine = v.youAre === "challenger";
  return (
    <div className="ar-glass" style={{ textAlign: "center", display: "grid", gap: ".8em" }}>
      <p className="ar-name" style={{ fontSize: "1.3em" }}>{mine ? `Waiting for ${v.opponent.name} to accept…` : `${v.opponent.name} challenged you`}</p>
      <p className="ar-muted">{v.topic ? `Topic: ${v.topic}` : "Whole course"} · {v.totalRounds} questions · {v.rules.questionSeconds}s each</p>
      {mine ? <button type="button" className="ar-btn ar-ghost" onClick={() => void act("leave")}>Cancel challenge</button>
        : <div className="ar-row" style={{ justifyContent: "center" }}><button type="button" className="ar-btn" onClick={() => void act("accept")}>Accept</button><button type="button" className="ar-btn ar-ghost" onClick={() => void act("decline")}>Decline</button></div>}
    </div>
  );
}

function Chat({ v, act, quick }: { v: MatchView; act: Act; quick?: boolean }) {
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [v.messages.length]);
  const send = async (body: string) => { if (!body.trim()) return; if (await act("message", { body })) setText(""); };
  return (
    <>
      <div className="ar-pmsgs" ref={box} aria-live="polite">
        {v.messages.length === 0 && <div className="ar-muted">No messages yet.</div>}
        {v.messages.map((m) => <div key={m.id} className={`ar-m ${m.from === "me" ? "ar-me" : "ar-them"}`}>{m.body}</div>)}
      </div>
      {quick && <div className="ar-pq">{QUICK.map((q) => <button key={q} type="button" onClick={() => void send(q)}>{q}</button>)}</div>}
      <form className="ar-pform" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Write a message" aria-label="Message" />
        <button type="submit" className="ar-btn ar-sm">Send</button>
      </form>
    </>
  );
}

function Lobby({ v, act }: { v: MatchView; act: Act }) {
  return (
    <div className="ar-glass" style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto minmax(0,1fr)", gap: ".6em", minHeight: 0 }}>
      <div className="ar-vs">
        <div className="ar-pc"><Avatar p={v.me} big /><div className="ar-name">You</div><span className={`ar-ready${v.ready.me ? " ar-on" : ""}`}>{v.ready.me ? "Ready" : "Not ready"}</span></div>
        <div className="ar-vsb">VS</div>
        <div className="ar-pc"><Avatar p={v.opponent} big /><div className="ar-name">{v.opponent.name}</div><span className={`ar-ready${v.ready.opponent ? " ar-on" : ""}`}>{v.ready.opponent ? "Ready" : "Not ready"}</span></div>
      </div>
      <div className="ar-row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
        <span className="ar-pill">{v.totalRounds} questions</span><span className="ar-pill">{v.rules.questionSeconds}s each</span><span className="ar-pill">+{v.rules.bonusPercent}% bonus</span>
        <button type="button" className="ar-btn" onClick={() => void act("ready", { ready: !v.ready.me })}>{v.ready.me ? "Not ready" : "I'm ready"}</button>
        <button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => void act("leave")}>Leave</button>
      </div>
      <div style={{ display: "grid", gridTemplateRows: "minmax(0,1fr) auto", gap: ".4em", minHeight: 0 }}><Chat v={v} act={act} quick /></div>
    </div>
  );
}

function Board({ v, act }: { v: MatchView; act: Act }) {
  const mine = v.turn === "me";
  return (
    <>
      <div className={`ar-pickmsg${mine ? "" : " ar-opp"}`}>
        <strong>{mine ? "Pick a number" : `${v.opponent.name} is picking a number…`}</strong>
        <span>{mine ? `Each number hides a question. If you don't choose, one is picked for you.` : "Get ready: a question is coming."}</span>
      </div>
      <div className="ar-picker" role="group" aria-label="Numbers">
        {Array.from({ length: v.board.size }, (_, i) => i + 1).map((n) => {
          const used = v.board.used.includes(n);
          return <button key={n} type="button" className={`ar-num${used ? " ar-used" : ""}`} disabled={used || !mine} onClick={() => void act("pick", { number: n })} aria-label={`Number ${n}${used ? " (used)" : ""}`}>{n}</button>;
        })}
      </div>
    </>
  );
}

function Question({ v, act, secs }: { v: MatchView; act: Act; secs: number | null }) {
  const r = v.round;
  const [locked, setLocked] = useState(false);
  if (!r) return <div className="ar-glass">Getting the next question…</div>;
  const stealing = r.stage === "STEAL";
  const reveal = r.stage === "REVEAL" ? v.reveal : null;
  const canAnswer = r.iCanAnswer && !locked && secs !== 0;
  const submit = async (response: Record<string, unknown>) => { setLocked(true); if (!(await act("answer", { response }))) setLocked(false); };
  let note: { cls: string; text: string } | null = null;
  if (stealing) note = r.answerer === "me" ? { cls: "", text: `Bonus question! ${v.opponent.name} missed it. Get it right for ${r.bonusPoints} points.` } : { cls: "ar-info", text: `${v.opponent.name} has a bonus chance on this question.` };
  else if (r.stage === "ANSWER" && r.answerer === "opponent") note = { cls: "ar-info", text: `${v.opponent.name} is answering. If they miss, you get a bonus chance.` };
  if (reveal) {
    const who = reveal.awardedTo === "me" ? "You" : reveal.awardedTo === "opponent" ? v.opponent.name : null;
    note = who ? { cls: "ar-ok", text: `${who} earned ${reveal.points} points${reveal.outcome === "STOLEN" ? " (bonus)" : ""}.` } : { cls: "ar-miss", text: "Nobody got this one. Here is the answer." };
  }
  const s = r.served;
  return (
    <div className="ar-qcard">
      <div className="ar-meta">
        <span className="ar-tag">{s?.topic ?? "Question"}</span>
        {s && <span className={`ar-tag${s.level === "Hard" ? " ar-hard" : ""}`}>{s.level}</span>}
        <span className="ar-tag">{r.points} pts</span>
        {stealing && <span className="ar-tag ar-bonus">Bonus +{v.rules.bonusPercent}%</span>}
      </div>
      {s ? <Body s={s} canAnswer={canAnswer} reveal={reveal?.answer ?? null} locked={locked} onSubmit={submit} /> : <div className="ar-hiddenq">Question hidden</div>}
      {reveal?.answer.explanation && <div className="ar-note ar-info">{reveal.answer.explanation}</div>}
      <div className="ar-fbw">{note && <div className={`ar-note ${note.cls}`}>{note.text}</div>}{!note && locked && <div className="ar-note ar-info">Answer locked in…</div>}</div>
    </div>
  );
}

function Body({ s, canAnswer, reveal, locked, onSubmit }: { s: ServedRound; canAnswer: boolean; reveal: Reveal | null; locked: boolean; onSubmit: (r: Record<string, unknown>) => void }) {
  if (s.format === "QUIZ") {
    return (
      <>
        <p className="ar-q">{s.question}</p>
        <div className="ar-opts">
          {s.options.map((o, i) => {
            const right = reveal?.correctKey === o.key;
            return (
              <button key={o.key} type="button" className={`ar-opt${right ? " ar-ok" : ""}${!canAnswer && !reveal ? " ar-wait" : ""}`} disabled={!canAnswer} onClick={() => onSubmit({ choice: o.key })}>
                <b>{String.fromCharCode(65 + i)}</b>{o.text}
              </button>
            );
          })}
        </div>
      </>
    );
  }
  if (s.format === "SCENARIO") {
    return (
      <>
        <div className="ar-scn">{s.situation}</div>
        <div className="ar-opts ar-one">
          {s.options.map((o, i) => (
            <button key={o} type="button" className={`ar-opt${reveal?.best === o ? " ar-ok" : ""}`} disabled={!canAnswer} onClick={() => onSubmit({ choice: o })}><b>{String.fromCharCode(65 + i)}</b>{o}</button>
          ))}
        </div>
        {reveal?.bestOutcome && <div className="ar-note ar-info">{reveal.bestOutcome}</div>}
      </>
    );
  }
  if (s.format === "MATCHING") return <Matching s={s} canAnswer={canAnswer} reveal={reveal} onSubmit={onSubmit} />;
  return <Ordering s={s} canAnswer={canAnswer} reveal={reveal} locked={locked} onSubmit={onSubmit} />;
}

function Matching({ s, canAnswer, reveal, onSubmit }: { s: Extract<ServedRound, { format: "MATCHING" }>; canAnswer: boolean; reveal: Reveal | null; onSubmit: (r: Record<string, unknown>) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const used = new Set(Object.values(map));
  const done = Object.keys(map).length === s.lefts.length;
  return (
    <>
      <p className="ar-q">{s.prompt}</p>
      <div className="ar-mt">
        <div>{s.lefts.map((l, i) => {
          const right = reveal?.pairs?.[i]?.right;
          return <button key={l} type="button" disabled={!canAnswer} className={`${sel === i ? "ar-p" : ""}${map[i] ? " ar-m" : ""}`} onClick={() => { if (map[i]) { const n = { ...map }; delete n[i]; setMap(n); } else setSel(i); }}>{l}{map[i] ? ` → ${map[i]}` : right ? ` → ${right}` : ""}</button>;
        })}</div>
        <div>{s.rights.map((r) => (
          <button key={r} type="button" disabled={!canAnswer || used.has(r)} className={used.has(r) ? "ar-m" : ""} onClick={() => { if (sel === null) return; setMap({ ...map, [sel]: r }); setSel(null); }}>{r}</button>
        ))}</div>
      </div>
      {canAnswer && <button type="button" className="ar-btn ar-go" disabled={!done} onClick={() => onSubmit({ matches: map })}>Lock in</button>}
    </>
  );
}

function Ordering({ s, canAnswer, reveal, locked, onSubmit }: { s: Extract<ServedRound, { format: "ORDERING" }>; canAnswer: boolean; reveal: Reveal | null; locked: boolean; onSubmit: (r: Record<string, unknown>) => void }) {
  const [order, setOrder] = useState<string[]>(s.steps);
  const show = reveal?.correctOrder ?? order;
  const move = (i: number, d: number) => { const n = [...order]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; setOrder(n); };
  return (
    <>
      <p className="ar-q">{s.prompt}</p>
      <ol className="ar-ord">
        {show.map((t, i) => (
          <li key={t}><span className="ar-t">{t}</span>{canAnswer && !locked && <span className="ar-mv"><button type="button" onClick={() => move(i, -1)} aria-label="Move up">↑</button><button type="button" onClick={() => move(i, 1)} aria-label="Move down">↓</button></span>}</li>
        ))}
      </ol>
      {canAnswer && <button type="button" className="ar-btn ar-go" onClick={() => onSubmit({ order })}>Lock in</button>}
    </>
  );
}

function PauseOverlay({ v, act, serverNow }: { v: MatchView; act: Act; serverNow: () => number }) {
  const left = useCountdown(v.paused?.resumesAt ?? null, serverNow);
  return (
    <div className="ar-pause" role="dialog" aria-label="Game paused">
      <div className="ar-pbox">
        <div className="ar-ph"><strong>⏸ Game paused {v.paused?.by === "me" ? "by you" : `by ${v.opponent.name}`}</strong><span className="ar-pill">Resumes by itself in {left === null ? "…" : Math.ceil(left / 1000)}s</span></div>
        <div style={{ display: "grid", gridTemplateRows: "minmax(0,1fr) auto auto", gap: ".4em", minHeight: 0 }}><Chat v={v} act={act} quick /></div>
        <div className="ar-pf"><span className="ar-muted">The question is hidden while paused.</span><button type="button" className="ar-btn" onClick={() => void act("resume")}>Resume game</button></div>
      </div>
    </div>
  );
}

function Result({ v }: { v: MatchView }) {
  const r = v.result;
  if (!r) return null;
  const head = r.winner === "me" ? "You won! 🏆" : r.winner === "draw" ? "It's a draw" : `${v.opponent.name} won`;
  const sub = r.reason === "left" || r.reason === "forfeit" ? "The match ended early." : r.reason === "inactive" ? "The match ended because a player stopped responding." : null;
  return (
    <div className="ar-glass ar-win" style={{ width: "100%", textAlign: "center", display: "grid", gap: ".6em", overflow: "auto", maxHeight: "100%" }}>
      <div className="ar-big">{head}</div>
      <div className="ar-name">{r.myScore} – {r.opponentScore}</div>
      {sub && <div className="ar-muted">{sub}</div>}
      <div className="ar-muted">You answered {r.answered}, got {r.correct} right.</div>
      <div className="ar-bars">
        {r.topics.map((t) => <div key={t.topic}><span>{t.topic}</span><span className="ar-track"><i className={t.correct / t.total < 0.5 ? "ar-low" : ""} style={{ width: `${Math.round((t.correct / t.total) * 100)}%`, display: "block" }} /></span><span>{t.correct}/{t.total}</span></div>)}
      </div>
      <div><a className="ar-btn" href={`/trainee/arena/${v.courseId}`} style={{ textDecoration: "none", display: "inline-block" }}>Back to the arena</a></div>
    </div>
  );
}
