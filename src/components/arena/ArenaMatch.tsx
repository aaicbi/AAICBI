"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMOJI } from "./reactions";
import { useRouter } from "next/navigation";
import ArenaFrame from "./ArenaFrame";
import { useArenaLive, channels } from "./useArenaLive";
import * as sfx from "./sound";
import { burst, floatText } from "./confetti";
import { STEAL_SECONDS } from "@/lib/arena/configCore";
import type { MatchView } from "@/lib/arena/arenaView";
import type { Reveal, ServedRound } from "@/lib/arena/arenaPool";

const QUICK = ["Good luck!", "Back in a minute", "Ready when you are", "Well played"];
type Act = (action: string, body?: Record<string, unknown>) => Promise<boolean>;

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

/** Numbers that count up to a new value, so a score change is something you see. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current; const t0 = performance.now(); const dur = 700;
    if (start === value) return;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

export default function ArenaMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [sound, setSound] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [heroes, setHeroes] = useState<{ id: string; e: string; who: string }[]>([]);
  const [intro, setIntro] = useState<number | null>(null);
  const [rxOpen, setRxOpen] = useState(false);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const lastScore = useRef<{ me: number; opp: number } | null>(null);
  const introDone = useRef(false);
  const fx = useRef<HTMLDivElement>(null);
  const soundOn = useRef(false);

  const { data: v, setData, error, serverNow } = useArenaLive<MatchView>(`/api/arena/matches/${matchId}`, { listen: [channels.match(matchId)] });

  useEffect(() => {
    if (!v || sound !== null) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem("arena-sound"); } catch { /* private mode */ }
    setSound(stored === null ? true : stored === "1");
  }, [v, sound]);
  soundOn.current = !!sound;
  const play = useCallback((fn: () => void) => { if (soundOn.current) fn(); }, []);
  const setSoundPref = (on: boolean) => { setSound(on); soundOn.current = on; try { localStorage.setItem("arena-sound", on ? "1" : "0"); } catch { /* ignore */ } if (on) sfx.tap(); };

  const note = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }, []);
  const act = useCallback<Act>(async (action, body = {}) => {
    try {
      const res = await fetch(`/api/arena/matches/${matchId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { note(j.error ?? "That didn't work."); return false; }
      setData(j as MatchView);
      return true;
    } catch { note("You seem to be offline."); return false; }
  }, [matchId, setData, note]);

  // 3-2-1-GO when a match begins.
  useEffect(() => {
    if (!v || introDone.current) return;
    if (v.status === "ACTIVE" && v.roundNo === 0 && v.board.used.length === 0) {
      introDone.current = true;
      let n = 3; setIntro(n); play(() => sfx.countHit(3));
      const id = setInterval(() => {
        n -= 1;
        if (n > 0) { setIntro(n); play(() => sfx.countHit(n)); }
        else if (n === 0) { setIntro(0); play(sfx.go); burst(fx.current, { count: 30, y: 55, power: 0.8 }); }
        else { setIntro(null); clearInterval(id); }
      }, 800);
    } else if (v.status !== "LOBBY" && v.status !== "PENDING") introDone.current = true;
  }, [v, play]);

  // A rematch both players are in: go to its lobby.
  useEffect(() => { if (v?.rematch && (v.rematch.status === "LOBBY" || v.rematch.status === "ACTIVE")) router.push(`/trainee/arena/match/${v.rematch.id}`); }, [v?.rematch, router]);

  // Reactions from either player.
  useEffect(() => {
    if (!v) return;
    if (seen.current === null) { seen.current = new Set(v.reactions.map((r) => r.id)); return; }
    for (const r of v.reactions) {
      if (seen.current.has(r.id)) continue;
      seen.current.add(r.id);
      const em = EMOJI[r.kind]; if (!em) continue;
      play(() => sfx.reactionPop(r.kind));
      if (r.kind === "cheer" || r.kind === "gg") burst(fx.current, { count: 22, y: 60 });
      const item = { id: r.id, e: em.e, who: r.from === "me" ? "You" : v.opponent.name };
      setHeroes((h) => [...h, item]);
      setTimeout(() => setHeroes((h) => h.filter((x) => x.id !== item.id)), 2700);
    }
  }, [v, play]);

  // Messages ping.
  const msgCount = useRef<number | null>(null);
  useEffect(() => {
    if (!v) return;
    if (msgCount.current !== null && v.messages.length > msgCount.current && v.messages[v.messages.length - 1]?.from === "opponent") play(sfx.message);
    msgCount.current = v.messages.length;
  }, [v, play]);

  // Round outcomes: sound, confetti, flashes and flying points.
  const lastReveal = useRef<string | null>(null);
  useEffect(() => {
    if (!v) return;
    const prev = lastScore.current;
    lastScore.current = { me: v.me.score, opp: v.opponent.score };
    const key = v.reveal && v.round ? `${v.round.idx}` : null;
    if (key && key !== lastReveal.current && prev) {
      lastReveal.current = key;
      const gained = v.me.score - prev.me;
      if (gained > 0) {
        play(() => sfx.correct(v.streak.me)); play(() => setTimeout(sfx.coin, 260));
        burst(fx.current, { count: 36 + Math.min(40, v.streak.me * 8), y: 55 });
        floatText(fx.current, `+${gained}`, { x: 50, y: 40 });
        setFlash("good"); setTimeout(() => setFlash(null), 700);
      } else if (v.reveal?.awardedTo === "opponent") {
        play(sfx.wrong); setFlash("bad"); setTimeout(() => setFlash(null), 700);
      } else play(sfx.wrong);
    }
    if (v.round?.stage === "ANSWER") lastReveal.current = null;
  }, [v, play]);

  // A new question arrives, or a bonus chance opens.
  const lastStage = useRef<string | null>(null);
  useEffect(() => {
    if (!v) return;
    const st = v.round ? `${v.round.idx}-${v.round.stage}` : v.phase ? `pick-${v.board.used.length}` : null;
    if (st && st !== lastStage.current) {
      if (lastStage.current !== null) {
        if (v.round?.stage === "STEAL") { if (v.round.iCanAnswer) play(sfx.stealAlert); }
        else if (v.round?.stage === "ANSWER") play(sfx.whoosh);
      }
      lastStage.current = st;
    }
  }, [v, play]);

  // Final result.
  const resultSound = useRef(false);
  useEffect(() => {
    if (!v?.result || resultSound.current) return;
    resultSound.current = true;
    if (v.result.winner === "me") { play(sfx.victory); setTimeout(() => { burst(fx.current, { count: 90, y: 40, power: 1.3 }); burst(fx.current, { count: 60, x: 20, y: 60 }); burst(fx.current, { count: 60, x: 80, y: 60 }); }, 150); }
    else if (v.result.winner === "draw") play(sfx.draw); else play(sfx.defeat);
  }, [v?.result, play]);

  // Leaving the game screen for the rest of the app pauses the game first (if the player has a pause left), so nothing is lost.
  const exit = useCallback(async (href: string) => {
    if (v && v.status === "ACTIVE" && !v.paused && v.me.pausesLeft > 0) await act("pause");
    router.push(href);
  }, [v, act, router]);

  const pausedNow = !!v?.paused;
  const phase = v?.phase ?? null;
  // Picking a number has no visible clock; only answering, the bonus chance and the short wait between questions do.
  const timed = phase === "ANSWER" || phase === "STEAL" || phase === "REVEAL";
  const endsAt = v && !pausedNow && v.status === "ACTIVE" && timed ? v.phaseEndsAt : null;
  const left = useCountdown(endsAt, serverNow);
  const secs = left === null ? null : Math.ceil(left / 1000);
  const total = v ? (phase === "STEAL" ? STEAL_SECONDS : phase === "ANSWER" ? v.rules.questionSeconds : 6) * 1000 : 1;

  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!sound || secs === null || !v || pausedNow || (phase !== "ANSWER" && phase !== "STEAL")) return;
    if (lastTick.current === secs) return;
    lastTick.current = secs;
    if (secs <= 0) return;
    if (secs <= 5) sfx.countdownBeep(secs);
    else if (v.rules.tickingSound) sfx.tick(secs <= 10);
  }, [secs, sound, phase, v, pausedNow]);

  if (error && !v) return <ArenaFrame title="Gaming Arena" backHref="/trainee/arena"><div className="ar-stage"><div className="ar-in" style={{ placeItems: "center", display: "grid" }}><p>{error.message}</p></div></div></ArenaFrame>;
  if (!v) return <ArenaFrame title="Gaming Arena" backHref="/trainee/arena"><div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center" }}>Loading the arena…</div></div></ArenaFrame>;

  const title = `${v.courseTitle}${v.topic ? ` · ${v.topic}` : ""}`;
  const urgent = secs !== null && secs <= 10;
  const pct = left === null ? 100 : Math.max(0, Math.min(100, (left / total) * 100));
  const over = v.status === "COMPLETED" || v.status === "FORFEITED";

  return (
    <ArenaFrame title={title} backHref={`/trainee/arena/${v.courseId}`} sound={!!sound} onSound={setSoundPref} onExit={exit}>
      <div className={`ar-stage${flash ? ` ar-flash-${flash}` : ""}`}>
        <div className="ar-orbs" aria-hidden><i /><i /><i /></div>
        <div className="ar-in">
          <div className="ar-top">
            <div className="ar-t">{v.status === "ACTIVE" ? `Question ${Math.min(Math.max(v.roundNo, 1), v.totalRounds)} of ${v.totalRounds}` : statusLabel(v)}</div>
            <div className="ar-prog" aria-hidden>{v.progress.map((p, i) => <i key={i} className={p === "won" ? "ar-d" : p === "lost" ? "ar-w" : p === "now" ? "ar-n" : ""} />)}</div>
            {v.status === "ACTIVE" && !pausedNow && <button type="button" className="ar-pill ar-pausebtn" disabled={v.me.pausesLeft === 0} onClick={() => void act("pause")}>⏸ Pause · {v.me.pausesLeft} left</button>}
          </div>
          <div className="ar-main">
            <div className="ar-col ar-board">
              <PlayerCard p={v.me} you active={v.turn === "me"} streak={v.streak.me} phase={v.phase} live={v.status === "ACTIVE"} />
              {v.status === "ACTIVE" && !pausedNow && (
                phase === "PICK" ? <div className="ar-timerbox"><div className="ar-lbl" style={{ margin: "auto 0" }}>no rush,<br />choose a number</div></div> : secs !== null && (
                  <div className="ar-timerbox">
                    <div className={`ar-timer${urgent ? " ar-hot" : ""}${phase === "STEAL" ? " ar-pick" : ""}`} style={{ ["--t" as string]: `${pct}%` }} role="timer" aria-label={`${secs} seconds left`}><span className="ar-tnum">{secs}</span></div>
                    <div className="ar-lbl">{phase === "STEAL" ? "bonus chance" : phase === "REVEAL" ? "next question" : "seconds left"}</div>
                  </div>
                )
              )}
              <PlayerCard p={v.opponent} active={v.turn === "opponent"} streak={v.streak.opponent} phase={v.phase} live={v.status === "ACTIVE"} />
            </div>
            <div className="ar-col ar-mid">{center(v, act, secs, play)}</div>
            <div className={`ar-col ar-rxcol${rxOpen ? " ar-rxopen" : ""}`}>
              <div className="ar-sheethead"><span className="ar-lbl">Reactions</span><button type="button" className="ar-sheetx" onClick={() => setRxOpen(false)} aria-label="Close reactions">✕</button></div>
              <div className={`ar-tray ar-t3${v.reactionsOpen ? "" : " ar-locked"}`}>
                {Object.entries(EMOJI).map(([k, x]) => (
                  <button key={k} type="button" className="ar-rx" disabled={!v.reactionsOpen} onClick={() => { play(() => sfx.reactionPop(k)); void act("react", { kind: k }); setRxOpen(false); }} aria-label={x.l}><span className="ar-e">{x.e}</span><span className="ar-l">{x.l}</span></button>
                ))}
              </div>
              <div className="ar-rxnote">{v.reactionsOpen ? (over ? "Say good game!" : "Send a reaction") : "Reactions open between questions"}</div>
            </div>
          </div>
          <div className="ar-dock">
            <button type="button" className="ar-dockbtn" onClick={() => setRxOpen((x) => !x)} aria-expanded={rxOpen}>😀 <span>{v.reactionsOpen ? "React" : "Reactions"}</span></button>
            {v.status === "ACTIVE" && !pausedNow && <button type="button" className="ar-dockbtn" disabled={v.me.pausesLeft === 0} onClick={() => void act("pause")}>⏸ <span>Pause · {v.me.pausesLeft}</span></button>}
          </div>
        </div>
        {rxOpen && <button type="button" className="ar-scrim" aria-label="Close reactions" onClick={() => setRxOpen(false)} />}
        <div className="ar-fx" ref={fx} aria-hidden>
          {heroes.map((h) => <div key={h.id} className="ar-hero"><div className="ar-big">{h.e}</div><span className="ar-who">{h.who}</span></div>)}
        </div>
        {intro !== null && <div className="ar-intro" aria-live="assertive"><div className="ar-introvs"><span>{v.me.name === "You" ? "You" : v.me.name.split(" ")[0]}</span><b>VS</b><span>{v.opponent.name.split(" ")[0]}</span></div><div key={intro} className="ar-countnum">{intro === 0 ? "GO!" : intro}</div></div>}
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
    case "COMPLETED": case "FORFEITED": return "Match over";
    case "DECLINED": return "Challenge declined";
    case "EXPIRED": return "Expired";
    default: return "Cancelled";
  }
}

function PlayerCard({ p, you, active, streak, phase, live }: { p: MatchView["me"]; you?: boolean; active: boolean; streak: number; phase: MatchView["phase"]; live: boolean }) {
  return (
    <div className={`ar-glass ar-pc${active && live ? " ar-active" : ""}`}>
      <div className="ar-avwrap"><Avatar p={p} />{streak >= 2 && <span className="ar-streak" title={`${streak} right in a row`}>🔥{streak}</span>}</div>
      <div className="ar-name">{you ? "You" : p.name}</div>
      <div className="ar-sub">{active && live ? (phase === "PICK" ? "choosing a number" : "in the hot seat") : " "}</div>
      <div className="ar-score" aria-label={`${p.score} points`}><CountUp value={p.score} /></div>
    </div>
  );
}

function center(v: MatchView, act: Act, secs: number | null, play: (fn: () => void) => void) {
  switch (v.status) {
    case "PENDING": return <Pending v={v} act={act} />;
    case "LOBBY": return <Lobby v={v} act={act} />;
    case "ACTIVE": return v.phase === "PICK" ? <Board v={v} act={act} play={play} /> : <Question key={v.round?.idx ?? "q"} v={v} act={act} secs={secs} />;
    case "COMPLETED": case "FORFEITED": return <Result v={v} act={act} />;
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

function Board({ v, act, play }: { v: MatchView; act: Act; play: (fn: () => void) => void }) {
  const mine = v.turn === "me";
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <div className={`ar-pickmsg${mine ? "" : " ar-opp"}`}>
        <strong>{mine ? "Your turn: pick a number" : `${v.opponent.name} is choosing a number…`}</strong>
        <span>{mine ? "Every number hides a question. Take your time." : "Get ready, a question is coming."}</span>
      </div>
      <div className="ar-picker" role="group" aria-label="Numbers">
        {Array.from({ length: v.board.size }, (_, i) => i + 1).map((n) => {
          const owner = v.board.owners[n];
          const used = v.board.used.includes(n);
          return (
            <button key={n} type="button" className={`ar-num${used ? ` ar-used ar-own-${owner ?? "none"}` : ""}${picked === n ? " ar-sel" : ""}${mine && !used ? " ar-ready-num" : ""}`} disabled={used || !mine || picked !== null}
              onClick={() => { setPicked(n); play(sfx.select); void act("pick", { number: n }).then((ok) => { if (!ok) setPicked(null); }); }} aria-label={`Number ${n}${used ? " (used)" : ""}`}>{used ? (owner === "me" ? "✓" : owner === "opponent" ? "✗" : "–") : n}</button>
          );
        })}
      </div>
    </>
  );
}

function Question({ v, act, secs }: { v: MatchView; act: Act; secs: number | null }) {
  const r = v.round;
  const [locked, setLocked] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  if (!r) return <div className="ar-glass">Getting the next question…</div>;
  const stealing = r.stage === "STEAL";
  const reveal = r.stage === "REVEAL" ? v.reveal : null;
  const canAnswer = r.iCanAnswer && !locked && secs !== 0;
  const submit = async (response: Record<string, unknown>, label?: string) => { setLocked(true); if (label) setChosen(label); if (!(await act("answer", { response }))) { setLocked(false); setChosen(null); } };
  let banner: { cls: string; text: string } | null = null;
  if (stealing) banner = r.answerer === "me" ? { cls: "ar-steal", text: `⚡ Bonus chance! ${v.opponent.name} missed it. Get it right for ${r.bonusPoints} points.` } : { cls: "ar-info", text: `${v.opponent.name} has a bonus chance on this one.` };
  else if (r.stage === "ANSWER" && r.answerer === "opponent") banner = { cls: "ar-info", text: `${v.opponent.name} is answering. If they miss, you get a bonus chance.` };
  const s = r.served;
  const who = reveal?.awardedTo === "me" ? "You" : reveal?.awardedTo === "opponent" ? v.opponent.name : null;
  return (
    <div className={`ar-qcard${reveal ? " ar-revealed" : ""}`}>
      <div className="ar-meta">
        <span className="ar-tag">{s?.topic ?? "Question"}</span>
        {s && <span className={`ar-tag${s.level === "Hard" ? " ar-hard" : ""}`}>{s.level}</span>}
        <span className="ar-tag">{r.points} pts</span>
        {stealing && <span className="ar-tag ar-bonus">Bonus +{v.rules.bonusPercent}%</span>}
      </div>
      {s ? <Body s={s} canAnswer={canAnswer} reveal={reveal?.answer ?? null} chosen={chosen} locked={locked} onSubmit={submit} /> : <div className="ar-hiddenq">Question hidden</div>}
      {reveal && <RevealPanel reveal={reveal} who={who} />}
      <div className="ar-fbw">
        {banner && <div className={`ar-note ${banner.cls}`}>{banner.text}</div>}
        {!banner && !reveal && locked && <div className="ar-note ar-info">Answer locked in…</div>}
      </div>
    </div>
  );
}

function RevealPanel({ reveal, who }: { reveal: NonNullable<MatchView["reveal"]>; who: string | null }) {
  const a = reveal.answer;
  const expl = a.format === "SCENARIO" ? a.bestOutcome ?? null : a.explanation;
  return (
    <div className={`ar-rv ${who ? "ar-ok" : "ar-miss"}`}>
      <div className="ar-rvh">{who ? `${who} earned ${reveal.points} points${reveal.outcome === "STOLEN" ? " (bonus)" : ""}` : "Nobody got this one, so here it is"}</div>
      {a.format === "QUIZ" && a.correctText && <div className="ar-rva">✔ Correct answer: <b>{a.correctText}</b></div>}
      {a.format === "SCENARIO" && a.best && <div className="ar-rva">✔ Best choice: <b>{a.best}</b></div>}
      {expl && <div className="ar-rvx">💡 {expl}</div>}
    </div>
  );
}

function Body({ s, canAnswer, reveal, chosen, locked, onSubmit }: { s: ServedRound; canAnswer: boolean; reveal: Reveal | null; chosen: string | null; locked: boolean; onSubmit: (r: Record<string, unknown>, label?: string) => void }) {
  if (s.format === "QUIZ") {
    return (
      <>
        <p className="ar-q">{s.question}</p>
        <div className="ar-opts">
          {s.options.map((o, i) => {
            const right = reveal?.correctKey === o.key;
            const mineWrong = !!reveal && chosen === o.key && !right;
            return (
              <button key={o.key} type="button" className={`ar-opt${right ? " ar-ok" : ""}${mineWrong ? " ar-no" : ""}${chosen === o.key && !reveal ? " ar-picked" : ""}${!canAnswer && !reveal && chosen !== o.key ? " ar-wait" : ""}`} disabled={!canAnswer} onClick={() => onSubmit({ choice: o.key }, o.key)}>
                <b>{right ? "✔" : mineWrong ? "✗" : String.fromCharCode(65 + i)}</b><span>{o.text}</span>
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
          {s.options.map((o, i) => {
            const right = reveal?.best === o;
            const mineWrong = !!reveal && chosen === o && !right;
            return <button key={o} type="button" className={`ar-opt${right ? " ar-ok" : ""}${mineWrong ? " ar-no" : ""}${chosen === o && !reveal ? " ar-picked" : ""}`} disabled={!canAnswer} onClick={() => onSubmit({ choice: o }, o)}><b>{right ? "✔" : mineWrong ? "✗" : String.fromCharCode(65 + i)}</b><span>{o}</span></button>;
          })}
        </div>
      </>
    );
  }
  if (s.format === "MATCHING") return <Matching s={s} canAnswer={canAnswer} reveal={reveal} locked={locked} onSubmit={onSubmit} />;
  return <Ordering s={s} canAnswer={canAnswer} reveal={reveal} locked={locked} onSubmit={onSubmit} />;
}

const PAIR_COLORS = ["#00564d", "#d99a34", "#e0566a", "#2d9d5f", "#3b6fd4", "#8a5cc7"];

/** Matching works like the platform's practice game: tap a term, tap its meaning, and both cards get the same number and colour. */
function Matching({ s, canAnswer, reveal, locked, onSubmit }: { s: Extract<ServedRound, { format: "MATCHING" }>; canAnswer: boolean; reveal: Reveal | null; locked: boolean; onSubmit: (r: Record<string, unknown>) => void }) {
  const [pairs, setPairs] = useState<Record<number, string>>({});
  const [active, setActive] = useState<number | null>(0);
  const total = s.lefts.length;
  const done = Object.keys(pairs).length === total;
  const ownerOf = (text: string) => { const e = Object.entries(pairs).find(([, v]) => v === text); return e ? Number(e[0]) : undefined; };

  // At the reveal the right pairs are numbered the same way, so a missed one can be read straight off the board.
  const truth = reveal?.pairs;
  const revealOwner = (right: string) => truth ? truth.findIndex((p) => p.right === right) : -1;

  const pickLeft = (i: number) => {
    if (!canAnswer) return;
    if (pairs[i] !== undefined) { const n = { ...pairs }; delete n[i]; setPairs(n); }
    setActive(i);
  };
  const pickRight = (text: string) => {
    if (!canAnswer) return;
    const owner = ownerOf(text);
    if (owner !== undefined) { const n = { ...pairs }; delete n[owner]; setPairs(n); setActive(owner); return; }
    if (active === null) return;
    const next = { ...pairs, [active]: text };
    setPairs(next);
    const waiting = s.lefts.findIndex((_, i) => i !== active && next[i] === undefined);
    setActive(waiting >= 0 ? waiting : null);
  };

  const badge = (n: number) => <span className="ar-badge" style={{ background: PAIR_COLORS[n % 6] }}>{n + 1}</span>;
  return (
    <>
      <p className="ar-q">{s.prompt}</p>
      <p className={`ar-hint${truth ? " ar-hintok" : ""}`}>{truth ? `✔ The correct matches are numbered${locked ? ". Wrong ones of yours are marked" : ""}.` : canAnswer ? "Tap a term, then its meaning. Matched cards share a number and colour. Tap a matched card to undo." : "Waiting for the answer…"}</p>
      <div className="ar-mt">
        <div>{s.lefts.map((l, i) => {
          const mine = pairs[i];
          const n = truth ? i : mine !== undefined ? i : -1;
          return (
            <button key={l} type="button" disabled={!canAnswer} aria-pressed={active === i}
              className={`${active === i && canAnswer ? "ar-p" : ""}${n >= 0 ? " ar-paired" : ""}`} style={n >= 0 ? { ["--pc" as string]: PAIR_COLORS[n % 6] } : undefined}
              onClick={() => pickLeft(i)}>
              {n >= 0 && badge(n)}<span className="ar-mtext">{l}</span>
              {truth && locked && pairs[i] !== undefined && truth[i] && pairs[i] !== truth.find((p) => p.left === l)?.right && <span className="ar-chip-no" title="What you chose">you chose “{pairs[i]}”</span>}
            </button>
          );
        })}</div>
        <div>{s.rights.map((r) => {
          const owner = truth ? revealOwner(r) : ownerOf(r);
          const has = owner !== undefined && owner >= 0;
          return (
            <button key={r} type="button" disabled={!canAnswer} className={has ? "ar-paired" : ""} style={has ? { ["--pc" as string]: PAIR_COLORS[owner! % 6] } : undefined} onClick={() => pickRight(r)}>
              {has && badge(owner!)}<span className="ar-mtext">{r}</span>
            </button>
          );
        })}</div>
      </div>
      {canAnswer && <button type="button" className="ar-btn ar-go" disabled={!done} onClick={() => onSubmit({ matches: pairs })}>{done ? "Lock in" : `Matched ${Object.keys(pairs).length} of ${total}`}</button>}
    </>
  );
}

function Ordering({ s, canAnswer, reveal, locked, onSubmit }: { s: Extract<ServedRound, { format: "ORDERING" }>; canAnswer: boolean; reveal: Reveal | null; locked: boolean; onSubmit: (r: Record<string, unknown>) => void }) {
  const [order, setOrder] = useState<string[]>(s.steps);
  const truth = reveal?.correctOrder;
  const show = truth ?? order;
  const mine = locked ? order : null; // only this player's own tries are ever shown to them
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{ key: string; startY: number; pid: number } | null>(null);
  const [dragging, setDragging] = useState<{ key: string; dy: number } | null>(null);
  const editable = canAnswer && !locked;

  const moveTo = (key: string, to: number) => setOrder((o) => { const from = o.indexOf(key); if (from < 0 || to < 0 || to >= o.length || from === to) return o; const n = [...o]; n.splice(to, 0, n.splice(from, 1)[0]!); return n; });

  // Drag by the grip with a finger or a mouse: the row follows the pointer and the others make room.
  const onDown = (e: React.PointerEvent<HTMLElement>, key: string) => {
    if (!editable) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key, startY: e.clientY, pid: e.pointerId };
    setDragging({ key, dy: 0 });
  };
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current; const list = listRef.current;
    if (!d || !list || e.pointerId !== d.pid) return;
    const rows = Array.from(list.children) as HTMLElement[];
    const i = order.indexOf(d.key);
    const me = rows[i];
    if (!me) return;
    // Keep the row under the finger when the card has to scroll.
    const card = list.closest(".ar-qcard") as HTMLElement | null;
    if (card) { const cr = card.getBoundingClientRect(); if (e.clientY < cr.top + 36) card.scrollBy(0, -10); else if (e.clientY > cr.bottom - 36) card.scrollBy(0, 10); }
    const rect = me.getBoundingClientRect();
    const centre = rect.top + rect.height / 2;
    const prev = rows[i - 1]; const next = rows[i + 1];
    if (prev && centre < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
      d.startY -= me.offsetTop - prev.offsetTop;
      moveTo(d.key, i - 1);
    } else if (next && centre > next.getBoundingClientRect().top + next.offsetHeight / 2) {
      d.startY += next.offsetTop + next.offsetHeight - (me.offsetTop + me.offsetHeight);
      moveTo(d.key, i + 1);
    }
    setDragging({ key: d.key, dy: e.clientY - d.startY });
  };
  const onUp = () => { drag.current = null; setDragging(null); };
  const onKey = (e: React.KeyboardEvent, key: string, i: number) => {
    if (!editable) return;
    if (e.key === "ArrowUp") { e.preventDefault(); moveTo(key, i - 1); } else if (e.key === "ArrowDown") { e.preventDefault(); moveTo(key, i + 1); }
  };

  return (
    <>
      <p className="ar-q">{s.prompt}</p>
      {truth ? <p className="ar-hint ar-hintok">✔ The correct order{mine ? ", with where you put each step" : ""}</p> : editable ? <p className="ar-hint">Hold the ⠿ handle and drag each step into place. Keyboard: arrow keys.</p> : null}
      <ol className="ar-ord" ref={listRef}>
        {show.map((t, i) => {
          const myPos = truth && mine ? mine.indexOf(t) : -1;
          const off = myPos >= 0 && myPos !== i;
          const isDrag = dragging?.key === t;
          return (
            <li key={t} className={`${truth ? "ar-ok" : ""}${isDrag ? " ar-dragging" : ""}`} style={isDrag ? { transform: `translateY(${dragging!.dy}px)` } : undefined}>
              <span className="ar-n">{i + 1}</span>
              {truth && <span className="ar-tick" aria-hidden>✔</span>}
              <span className="ar-t">{t}</span>
              {off && <span className="ar-chip-no" title="Where you put it">you put it {myPos + 1}</span>}
              {editable && (
                <span className="ar-grip" role="button" tabIndex={0} aria-label={`Move “${t}”. Drag, or use the up and down arrow keys.`}
                  onPointerDown={(e) => onDown(e, t)} onPointerMove={(e) => onMove(e)} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={(e) => onKey(e, t, i)}>⠿</span>
              )}
            </li>
          );
        })}
      </ol>
      {canAnswer && <button type="button" className="ar-btn ar-go" onClick={() => onSubmit({ order })}>Lock in</button>}
    </>
  );
}

function PauseOverlay({ v, act, serverNow }: { v: MatchView; act: Act; serverNow: () => number }) {
  const left = useCountdown(v.paused?.resumesAt ?? null, serverNow);
  const [quitting, setQuitting] = useState(false);
  return (
    <div className="ar-pause" role="dialog" aria-label="Game paused">
      <div className="ar-pbox">
        <div className="ar-ph"><strong>⏸ Game paused {v.paused?.by === "me" ? "by you" : `by ${v.opponent.name}`}</strong><span className="ar-pill">Resumes by itself in {left === null ? "…" : Math.ceil(left / 1000)}s</span></div>
        <div style={{ display: "grid", gridTemplateRows: "minmax(0,1fr) auto auto", gap: ".4em", minHeight: 0 }}><Chat v={v} act={act} quick /></div>
        {quitting ? (
          <div className="ar-quit" role="alertdialog" aria-label="Quit the game">
            <p><strong>Quit this game?</strong> {v.opponent.name} is told you left and wins automatically.</p>
            <div className="ar-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => setQuitting(false)}>Keep playing</button>
              <button type="button" className="ar-btn ar-danger ar-sm" onClick={() => void act("leave")}>Yes, quit</button>
            </div>
          </div>
        ) : (
          <div className="ar-pf">
            <button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => setQuitting(true)}>Quit game</button>
            <a className="ar-btn ar-ghost ar-sm" href="/feed" style={{ textDecoration: "none" }}>Visit the app</a>
            <button type="button" className="ar-btn" onClick={() => void act("resume")}>Resume game</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Result({ v, act }: { v: MatchView; act: Act }) {
  const r = v.result;
  const router = useRouter();
  const [onlyMissed, setOnlyMissed] = useState(false);
  if (!r) return null;
  const quit = r.reason === "left";
  const head = quit ? (r.winner === "me" ? "You win! 🏆" : "You quit the game") : r.winner === "me" ? "Victory! 🏆" : r.winner === "draw" ? "It's a draw 🤝" : `${v.opponent.name} takes it`;
  const sub = quit ? (r.winner === "me" ? `${v.opponent.name} quit the game, so you win automatically.` : `You left the match, so ${v.opponent.name} wins.`) : r.winner === "me" ? "Brilliant. You earned it." : r.winner === "draw" ? "Evenly matched. Time for the decider?" : "Great effort. Every question you missed is now one you know.";
  const early = !quit && (r.reason === "forfeit" || r.reason === "inactive");
  const missed = r.recap.filter((x) => x.mine !== "correct");
  const rm = v.rematch;
  const rec = r.record;
  return (
    <div className="ar-glass ar-win">
      <div className="ar-stars" aria-label={`${r.stars} of 3 stars`}>{[1, 2, 3].map((n) => <span key={n} className={n <= r.stars ? "ar-on" : ""} style={{ animationDelay: `${n * 0.25}s` }}>★</span>)}</div>
      <div className="ar-big">{head}</div>
      <div className="ar-final">{r.myScore} <span>–</span> {r.opponentScore}</div>
      <div className="ar-muted">{early ? "The match ended early. " : ""}{sub}</div>
      <div className="ar-chips">
        <span className="ar-pill">✔ {r.correct} of {r.answered} right</span>
        {r.bestStreak >= 2 && <span className="ar-pill ar-gold">🔥 Best streak {r.bestStreak}</span>}
        {rec.wins + rec.losses + rec.draws > 1 && <span className="ar-pill">🤝 You {rec.wins} · {rec.losses} {v.opponent.name.split(" ")[0]}{rec.draws ? ` · ${rec.draws} draw${rec.draws > 1 ? "s" : ""}` : ""}</span>}
      </div>
      <div className="ar-actions">
        {!rm && <button type="button" className="ar-btn ar-big-btn" onClick={() => void act("rematch")}>🔁 Play again, new questions</button>}
        {rm && rm.status === "PENDING" && rm.from === "me" && <><span className="ar-pill ar-gold">Waiting for {v.opponent.name} to say yes…</span><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => void fetch(`/api/arena/matches/${rm.id}/leave`, { method: "POST" })}>Cancel</button></>}
        {rm && rm.status === "PENDING" && rm.from === "opponent" && <><span className="ar-pill ar-gold">{v.opponent.name} wants a rematch!</span><button type="button" className="ar-btn ar-big-btn" onClick={() => void fetch(`/api/arena/matches/${rm.id}/accept`, { method: "POST" }).then(() => router.push(`/trainee/arena/match/${rm.id}`))}>Accept rematch</button><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => void fetch(`/api/arena/matches/${rm.id}/decline`, { method: "POST" })}>Not now</button></>}
        <a className="ar-btn ar-ghost" href={`/trainee/arena/${v.courseId}`} style={{ textDecoration: "none", display: "inline-block" }}>Back to the arena</a>
      </div>
      {r.topics.length > 0 && (
        <section className="ar-sec" aria-label="How you did by topic">
          <h3>How you did by topic</h3>
          <div className="ar-bars">{r.topics.map((t) => (
            <div key={t.topic} className="ar-bar1">
              <span className="ar-bartopic" title={t.topic}>{t.topic}</span>
              <span className="ar-track"><i className={t.correct / t.total < 0.5 ? "ar-low" : ""} style={{ width: `${Math.round((t.correct / t.total) * 100)}%`, display: "block" }} /></span>
              <span className="ar-barn">{t.correct}/{t.total}</span>
            </div>
          ))}</div>
        </section>
      )}
      {r.recap.length > 0 && (
        <section className="ar-recap" aria-label="All the questions and answers">
          <div className="ar-rechead">
            <h3>{r.recap.length === 1 ? "The question and answer" : `All ${r.recap.length} questions and answers`}</h3>
            {missed.length > 0 && <button type="button" className="ar-btn ar-ghost ar-sm" aria-pressed={onlyMissed} onClick={() => setOnlyMissed((x) => !x)}>{onlyMissed ? "Show all" : `Only the ${missed.length} I missed`}</button>}
          </div>
          <p className="ar-muted">Read through them: the answer and the reason for each one.</p>
          <ol>
            {r.recap.map((x, i) => ({ x, i })).filter(({ x }) => !onlyMissed || x.mine !== "correct").map(({ x, i }) => (
              <li key={i} className={x.mine === "correct" ? "ar-got" : "ar-lost"}>
                <div className="ar-rtopic"><b>{`Q${x.n} · ${x.mine === "correct" ? "✔ You got this" : x.mine === "missed" ? "✗ You missed this" : "You didn't answer"}`}</b><span title={x.topic}>{x.topic}</span></div>
                <div className="ar-rprompt">{x.prompt}</div>
                <div className="ar-rans"><small>Answer</small>{x.answer}</div>
                {x.explanation && <div className="ar-rwhy"><small>Why</small>{x.explanation}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
