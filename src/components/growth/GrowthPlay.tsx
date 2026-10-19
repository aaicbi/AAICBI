"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CONSENT_TEXT, NICK_MAX, QUESTION_SECONDS, SQUAD_NAME_MAX, answerGrid } from "@/lib/growth/growthCore";
import * as snd from "@/components/arena/sound";
import { burst } from "@/components/arena/confetti";
import ArenaLogo from "./ArenaLogo";
import "./growthArena.css";
import type { PlayState } from "@/lib/growth/growth";

type State = PlayState;
export interface DuelIntro { code: string; name: string; score: number; total: number; rankLabel: string }
export interface SquadIntro { kind: "join" | "rival"; code: string; name: string; members: number; total: number; full: boolean }
interface Challenge { duelUrl: string; text: string; cardPath: string }
interface Feedback { correct: boolean; correctKey: string | null; explanation: string | null; chosen: string; timedOut: boolean; next: State }
const SOUND_KEY = "aaicbi.growth.sound";

/** The public taster: five questions, no account. The browser keeps only a random token so a refresh does not lose the run. */
export default function GrowthPlay({ slug, courseId, courseTitle, organizationName, source, duel, squadIntro }: { slug: string; courseId: string; courseTitle: string; organizationName: string | null; source: string | null; duel: DuelIntro | null; squadIntro: SquadIntro | null }) {
  const [state, setState] = useState<State | null>(null);
  const [started, setStarted] = useState(false);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [squadOpen, setSquadOpen] = useState(false);
  const [squadNameInput, setSquadNameInput] = useState("");
  const [squadBusy, setSquadBusy] = useState(false);
  const [squadError, setSquadError] = useState<string | null>(null);
  const [copiedSquad, setCopiedSquad] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [left, setLeft] = useState(QUESTION_SECONDS * 1000);
  const [streak, setStreak] = useState(0);
  const token = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const soundRef = useRef(true);
  const streakRef = useRef(0);
  const answering = useRef(false);
  const chooseRef = useRef<(choice: string | null, timedOut?: boolean) => Promise<void>>(async () => {});
  const baseKey = `aaicbi.growth.${slug}`;
  // A duel link keeps its own run, so opening a friend's challenge never resumes (or overwrites) your own earlier result.
  const key = duel ? `${baseKey}.duel.${duel.code}` : squadIntro ? `${baseKey}.${squadIntro.kind}.${squadIntro.code}` : baseKey;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try { const v = window.localStorage.getItem(SOUND_KEY); if (v === "off") { setSound(false); soundRef.current = false; } } catch {}
    try { token.current = window.localStorage.getItem(key); } catch {}
    if (token.current) void begin(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [state?.status, state && state.status === "question" ? state.index : 0, fb === null]);
  // Each new screen starts at the top, under the Arena bar.
  useEffect(() => { rootRef.current?.scrollTo?.(0, 0); }, [state?.status, state && state.status === "question" ? state.index : 0, started]);

  const begin = useCallback(async (resume = false) => {
    setBusy(true); setError(null);
    const res = await fetch(`/api/public/growth/${slug}/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resume ? token.current : null, source, duel: !resume && duel ? duel.code : null, squad: !resume && squadIntro?.kind === "join" && !squadIntro.full ? squadIntro.code : null, rival: !resume && squadIntro?.kind === "rival" ? squadIntro.code : null, nickname: !resume && (duel || squadIntro) ? myName.trim() || null : null }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 410) { setEnded(true); return; }
    if (!res.ok) {
      if (resume) { try { window.localStorage.removeItem(key); } catch {} token.current = null; return; }
      setError(json.error ?? "That didn't work. Please try again.");
      return;
    }
    token.current = json.token;
    try { window.localStorage.setItem(key, json.token); window.localStorage.setItem(baseKey, json.token); } catch {}
    setState(json.state); setStarted(true); setFb(null);
    if (!resume && soundRef.current) snd.go();
  }, [slug, source, key, baseKey, duel, squadIntro, myName]);

  async function choose(choice: string | null, timedOut = false) {
    // A tap and the clock running out can arrive together: only the first one counts.
    if (!token.current || busy || fb || answering.current) return;
    answering.current = true;
    setBusy(true); setError(null);
    const res = await fetch(`/api/public/growth/${slug}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(timedOut ? { token: token.current, timedOut: true } : { token: token.current, choice }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { answering.current = false; setError(json.error ?? "That didn't work. Please try again."); return; }
    streakRef.current = json.correct ? streakRef.current + 1 : 0;
    setStreak(streakRef.current);
    if (soundRef.current) { if (json.correct) snd.correct(streakRef.current); else snd.wrong(); }
    setFb({ correct: json.correct, correctKey: json.correctKey, explanation: json.explanation, chosen: choice ?? "", timedOut, next: json.state });
  }
  chooseRef.current = choose;

  function toggleSound(on: boolean) {
    setSound(on); soundRef.current = on;
    try { window.localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch {}
    if (on) snd.select();
  }

  function goNext() {
    if (!fb) return;
    const next = fb.next;
    answering.current = false;
    setState(next); setFb(null);
    if (next.status === "done") {
      if (soundRef.current) { if (next.score >= 3) snd.victory(); else snd.defeat(); }
      if (next.score >= 3) setTimeout(() => burst(rootRef.current, { count: 70, y: 28 }), 250);
    } else if (soundRef.current) snd.whoosh();
  }

  // The clock for the question on screen. It stops while the answer is showing and while the tab is hidden, and a long stall cannot burn it all at once.
  const questionIndex = state?.status === "question" ? state.index : -1;
  useEffect(() => {
    if (questionIndex < 0 || fb) return;
    let remain = QUESTION_SECONDS * 1000;
    let last = performance.now();
    let lastSec = QUESTION_SECONDS + 1;
    let fired = false;
    answering.current = false;
    setLeft(remain);
    const id = setInterval(() => {
      const now = performance.now(); const dt = now - last; last = now;
      if (document.hidden || fired) return;
      remain = Math.max(0, remain - Math.min(dt, 500));
      setLeft(remain);
      const sec = Math.ceil(remain / 1000);
      if (sec !== lastSec && sec > 0) {
        lastSec = sec;
        if (soundRef.current) {
          (sec % 2 === 0 ? snd.tick : snd.tock)(sec <= 5);
          if (sec <= 3) snd.countdownBeep(sec);
        }
      }
      if (remain <= 0) { fired = true; clearInterval(id); void chooseRef.current(null, true); }
    }, 100);
    return () => clearInterval(id);
  }, [questionIndex, fb]);

  async function save() {
    if (!token.current || busy) return;
    setBusy(true); setSaveError(null);
    const res = await fetch(`/api/public/growth/${slug}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, phone: phone.trim() || null, consent }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setSaveError(json.error ?? "That didn't work. Please try again."); return; }
    setSaved(json.phone ?? "your number");
  }

  // While a result is on screen and there is a board to watch, check for friends who have taken the challenge.
  const hasBoard = state?.status === "done" && (challenge !== null || state.standings.length > 0 || state.squad !== null);
  useEffect(() => {
    if (!hasBoard) return;
    const timer = setInterval(async () => {
      if (!token.current || document.hidden) return;
      const res = await fetch(`/api/public/growth/${slug}/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current }) }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (res?.ok && json?.state?.status === "done") setState(json.state);
    }, 20000);
    return () => clearInterval(timer);
  }, [hasBoard, slug]);

  async function makeChallenge() {
    if (!token.current || challengeBusy) return;
    setChallengeBusy(true); setChallengeError(null);
    const res = await fetch(`/api/public/growth/${slug}/challenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, nickname: myName }) });
    const json = await res.json().catch(() => ({}));
    setChallengeBusy(false);
    if (!res.ok) { setChallengeError(json.error ?? "That didn't work. Please try again."); return; }
    setChallenge({ duelUrl: json.duelUrl, text: json.text, cardPath: json.cardPath });
  }

  async function shareCard() {
    if (!challenge) return;
    const url = `${challenge.cardPath}?format=status`;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "my-score.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: challenge.text }); return; }
    } catch {}
    window.open(url, "_blank", "noopener");
  }

  async function copyLink() {
    if (!challenge) return;
    try { await navigator.clipboard.writeText(challenge.duelUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }

  async function makeSquad() {
    if (!token.current || squadBusy || state?.status !== "done") return;
    setSquadBusy(true); setSquadError(null);
    const res = await fetch(`/api/public/growth/${slug}/squad`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, name: squadNameInput }) });
    const json = await res.json().catch(() => ({}));
    setSquadBusy(false);
    if (!res.ok) { setSquadError(json.error ?? "That didn't work. Please try again."); return; }
    setState({ ...state, squad: json.squad, rivalSquadName: null });
  }

  async function copySquad(which: string, url: string) {
    try { await navigator.clipboard.writeText(url); setCopiedSquad(which); setTimeout(() => setCopiedSquad(null), 1600); } catch {}
  }

  function playAgain() {
    try { window.localStorage.removeItem(key); } catch {}
    token.current = null; streakRef.current = 0; setStreak(0); answering.current = false; setState(null); setStarted(false); setFb(null); setSaved(null); setSaveOpen(false); setConsent(false); setChallenge(null); setSquadOpen(false); setSquadNameInput("");
  }

  const shell = (children: React.ReactNode) => <Shell rootRef={rootRef} sound={sound} onSound={toggleSound}>{children}</Shell>;

  if (ended) return shell(<div className="ga-light ga-card"><h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none font-display text-2xl font-bold text-brand-ink">This campaign has ended</h1><p className="mt-2 text-brand-ink">The free game is closed, but you can still look at the course.</p><Cta href={`/courses/${courseId}`}>See {courseTitle}</Cta></div>);

  if (!started || !state) {
    return shell(
      <>
        {organizationName && <span className="ga-pill gold">{organizationName}</span>}
        {squadIntro ? (
          <div className="space-y-3" data-testid="growth-squad-intro">
            <h1 ref={heading} tabIndex={-1} className="ga-h1 outline-none focus-visible:outline-none">{squadIntro.kind === "join" ? `Join ${squadIntro.name}` : `${squadIntro.name} challenged your squad`}</h1>
            <p className="ga-lead">
              {squadIntro.kind === "join"
                ? `${squadIntro.members} ${squadIntro.members === 1 ? "player is" : "players are"} in, with ${squadIntro.total} points so far. Play the same 5 questions and your score counts for the squad.`
                : `They have ${squadIntro.total} points from ${squadIntro.members} ${squadIntro.members === 1 ? "player" : "players"}. Play the same 5 questions, then start your own squad and beat them.`}
            </p>
            {squadIntro.full && squadIntro.kind === "join" ? <p className="ga-err" role="alert">This squad is full. You can still play on your own.</p> : null}
            <div>
              <label htmlFor="growth-squad-intro-name" className="ga-label">Your name (optional)</label>
              <input id="growth-squad-intro-name" maxLength={NICK_MAX} autoComplete="given-name" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="So the squad knows it was you" className="ga-input" data-testid="growth-squad-intro-name" />
            </div>
          </div>
        ) : duel ? (
          <div className="space-y-3" data-testid="growth-duel-intro">
            <h1 ref={heading} tabIndex={-1} className="ga-h1 outline-none focus-visible:outline-none">{duel.name} challenged you</h1>
            <p className="ga-lead">{duel.name} got {duel.score}/{duel.total} ({duel.rankLabel}) on {courseTitle}. You get the same {duel.total} questions. Can you beat them?</p>
            <div>
              <label htmlFor="growth-duel-name" className="ga-label">Your name (optional)</label>
              <input id="growth-duel-name" maxLength={NICK_MAX} autoComplete="given-name" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="So they know it was you" className="ga-input" data-testid="growth-duel-name" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h1 ref={heading} tabIndex={-1} className="ga-h1 outline-none focus-visible:outline-none">Do you think like an AI automation builder?</h1>
            <p className="ga-lead">5 questions from {courseTitle}. About 90 seconds. See your rank and what to learn next. No account needed.</p>
          </div>
        )}
        <div className="ga-chips" aria-label="How it works"><span>⏱ {QUESTION_SECONDS} seconds a question</span><span>{sound ? "🔊 Tick-tock sound on" : "🔇 Sound off"}</span><span>🏆 Get your rank</span></div>
        <button type="button" disabled={busy} onClick={() => begin(false)} className="ga-btn" data-testid="growth-start">{squadIntro ? (squadIntro.kind === "join" ? "Join the squad" : `Take on ${squadIntro.name}`) : duel ? "Take the challenge" : "Start the 5 questions"}</button>
        {error && <p className="ga-err" role="alert">{error}</p>}
        <p className="ga-note">Your answers are not tied to your name. The clock starts when the first question appears.</p>
      </>
    );
  }

  if (state.status === "question") {
    const showing = state;
    const q = showing.question;
    const secs = Math.ceil(left / 1000);
    const hot = !fb && secs <= 5;
    const pct = Math.max(0, Math.min(100, (left / (QUESTION_SECONDS * 1000)) * 100));
    return shell(
      <>
        <div className="ga-top"><span>Question {showing.index + 1} of {showing.total}</span>{showing.squadName && <span className="truncate" data-testid="growth-squad-label">Squad: {showing.squadName}</span>}{showing.duelAgainst && <span className="truncate" data-testid="growth-duel-label">Duel vs {showing.duelAgainst}</span>}{streak >= 2 && !showing.squadName && !showing.duelAgainst && <span data-testid="growth-streak">🔥 {streak} in a row</span>}</div>
        <div className="ga-prog" role="progressbar" aria-valuemin={0} aria-valuemax={showing.total} aria-valuenow={showing.index + (fb ? 1 : 0)} aria-label="Progress">
          {Array.from({ length: showing.total }, (_, n) => <i key={n} className={n < showing.index ? "d" : n === showing.index ? (fb ? (fb.correct ? "d" : "w") : "n") : ""} />)}
        </div>
        <div className="ga-timerwrap">
          <div className={`ga-timer ${hot ? "hot" : ""} ${fb ? "done" : ""}`} style={{ "--t": `${fb ? 0 : pct}%` } as React.CSSProperties} role="timer" aria-label={fb ? "Answered" : `${secs} seconds left`} data-testid="growth-timer"><span>{fb ? "✓" : secs}</span></div>
          <span className="ga-timelbl" aria-hidden="true">{fb ? (fb.timedOut ? "Time's up" : "Locked in") : hot ? "Hurry!" : "Seconds left"}</span>
        </div>
        <div className="ga-qcard">
          <span className="ga-tag">{courseTitle}</span>
          <h1 ref={heading} tabIndex={-1} className="ga-q outline-none focus-visible:outline-none" data-testid="growth-question">{q.text}</h1>
          <div className="ga-opts" role="group" aria-label="Answers">
            {q.options.map((o, n) => {
              const picked = fb?.chosen === o.key;
              const right = fb && o.key === fb.correctKey;
              const cls = fb ? (right ? "ok" : picked ? "no" : "dim") : "";
              return <button key={o.key} type="button" disabled={busy || !!fb} onClick={() => { if (soundRef.current) snd.select(); void choose(o.key); }} className={`ga-opt ${cls}`} data-testid="growth-option"><b aria-hidden="true">{String.fromCharCode(65 + n)}</b><span>{fb && right ? "✓ " : fb && picked ? "✗ " : ""}{o.text}</span></button>;
            })}
          </div>
        </div>
        {fb && (
          <div className={`ga-fb ${fb.correct ? "ok" : "no"}`} aria-live="polite">
            <p className="ga-fbt">{fb.timedOut ? "Time's up." : fb.correct ? "Correct." : "Not quite."}</p>
            {fb.explanation && <p className="ga-fbx">{fb.explanation}</p>}
          </div>
        )}
        {fb && <button type="button" onClick={goNext} className="ga-btn" data-testid="growth-next">{fb.next.status === "done" ? "See my result" : "Next question"}</button>}
        {error && <p className="ga-err" role="alert">{error}</p>}
      </>
    );
  }

  const r = state;
  return shell(
    <>
      {r.duel && (
        <div className="ga-gold" data-testid="growth-duel-headline">
          <p className="font-display text-xl font-extrabold">{r.duel.headline}</p>
          <p className="mt-1 text-sm">You {r.score}/{r.total} · {r.duel.opponentName} {r.duel.opponentScore}/{r.duel.opponentTotal}</p>
        </div>
      )}
      <div className="ga-herobox">
        <span className="ga-pill gold" data-testid="growth-rank">{r.rank.label}</span>
        <h1 ref={heading} tabIndex={-1} className="ga-score outline-none focus-visible:outline-none" data-testid="growth-score">{r.score}/{r.total}</h1>
        <p className="text-2xl" aria-label={`${r.grid.filter(Boolean).length} correct out of ${r.total}`}>{answerGrid(r.grid)}</p>
        {r.beatPercent !== null && <p className="ga-lead">You beat {r.beatPercent}% of players.</p>}
      </div>
      <section className="ga-cta" aria-labelledby="ga-cta-h" data-testid="growth-cta">
        <ArenaLogo className="ga-cta-logo" />
        <p className="ga-cta-kicker">Africa&apos;s AI Capacity Building Initiative</p>
        <h2 id="ga-cta-h" className="ga-cta-h">Africa is building with AI. Your seat is open.</h2>
        <p className="ga-cta-beat" aria-label="Learn it. Build it. Prove it."><span>Learn it.</span><span>Build it.</span><span>Prove it.</span></p>
        <p className="ga-cta-body">Join the movement to put millions of Africans to work with AI. Practical AI automation, real projects and proof of your skills, on one platform built for us.</p>
        <Link href={`/play/${slug}/continue`} className="ga-btn" data-testid="growth-continue">Start Module 1, free</Link>
        <Link href="/about" className="ga-btn ghost" data-testid="growth-about">Discover AAICBI</Link>
      </section>
      <div className="ga-dark">
      {r.standings.length > 0 && (
        <div className="mt-3 rounded-2xl bg-brand-surface p-4" data-testid="growth-standings">
          <p className="text-sm font-bold text-brand-ink">{r.duel ? "Standings in this challenge" : "Friends who took your challenge"}</p>
          <ol className="mt-2 space-y-1">
            {r.standings.map((row, i) => (
              <li key={`${row.name}-${i}`} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${row.you ? "bg-brand-mint font-bold text-brand-tealDeep" : "text-brand-ink"}`}>
                <span className="min-w-0 truncate">{i + 1}. {row.name}</span>
                <span className="shrink-0">{row.score}/{row.total}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {r.squad ? (
        <div className="mt-4 rounded-2xl bg-brand-surface p-4" data-testid="growth-squad-card">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Your squad</p>
          <p className="font-display text-xl font-extrabold text-brand-ink">{r.squad.name}</p>
          <p className="mt-1 text-sm text-brand-ink" data-testid="growth-squad-totals">{r.squad.total}/{r.squad.max} points · {r.squad.members}/{r.squad.maxMembers} members · average {r.squad.average} · #{r.squad.rank} of {r.squad.of} {r.squad.of === 1 ? "squad" : "squads"}</p>
          <ol className="mt-2 space-y-1" data-testid="growth-squad-board">
            {r.squad.board.map((m, i) => (
              <li key={`${m.name}-${i}`} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${m.you ? "bg-brand-mint font-bold text-brand-tealDeep" : "text-brand-ink"}`}>
                <span className="min-w-0 truncate">{i + 1}. {m.name}</span><span className="shrink-0">{m.score}/{r.total}</span>
              </li>
            ))}
          </ol>
          {[...(r.squad.rivalOf ? [{ ...r.squad.rivalOf, label: "Answering" }] : []), ...r.squad.rivals.map((x) => ({ ...x, label: "Rival" }))].map((x) => (
            <p key={`${x.label}-${x.name}`} className="mt-2 rounded-lg bg-brand-goldLight px-3 py-2 text-sm font-semibold text-brand-goldText" data-testid="growth-squad-rival">
              {x.label}: {x.name} · {x.total} points from {x.members} {x.members === 1 ? "player" : "players"} · {x.standing === "AHEAD" ? "you are ahead" : x.standing === "BEHIND" ? "they are ahead" : "level"}
            </p>
          ))}
          <a href={`https://wa.me/?text=${encodeURIComponent(r.squad.joinText)}`} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-[48px] items-center justify-center rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="growth-squad-invite">Invite friends to {r.squad.name}</a>
          <button type="button" onClick={() => copySquad("join", r.squad!.joinUrl)} className="mt-1 w-full py-2 text-center text-sm font-semibold text-brand-teal underline" data-testid="growth-squad-copy">{copiedSquad === "join" ? "Link copied" : "Copy the squad link"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(r.squad.rivalText)}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex min-h-[48px] items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint" data-testid="growth-squad-challenge">Challenge another squad</a>
          <button type="button" onClick={() => copySquad("rival", r.squad!.rivalUrl)} className="mt-1 w-full py-2 text-center text-sm font-semibold text-brand-teal underline" data-testid="growth-squad-rival-copy">{copiedSquad === "rival" ? "Link copied" : "Copy the challenge link"}</button>
        </div>
      ) : squadOpen || r.rivalSquadName ? (
        <form className="mt-4 rounded-2xl bg-brand-surface p-4" onSubmit={(e) => { e.preventDefault(); void makeSquad(); }} data-testid="growth-squad-form">
          <p className="text-sm font-bold text-brand-ink">{r.rivalSquadName ? `${r.rivalSquadName} challenged your squad. Start yours and beat them.` : "Start a squad. Friends play the same 5 questions and every score counts for the squad."}</p>
          <label htmlFor="growth-squad-name" className="mt-3 block text-sm font-semibold text-brand-ink">Squad name</label>
          <input id="growth-squad-name" maxLength={SQUAD_NAME_MAX} value={squadNameInput} onChange={(e) => setSquadNameInput(e.target.value)} placeholder="For example, Lagos Tech Women" className="mt-1 min-h-[48px] w-full rounded-xl border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="growth-squad-name" />
          {squadError && <p className="mt-2 text-sm text-brand-rose" role="alert">{squadError}</p>}
          <button type="submit" disabled={squadBusy} className="mt-3 min-h-[48px] w-full rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="growth-squad-create">Start my squad</button>
        </form>
      ) : (
        <button type="button" onClick={() => setSquadOpen(true)} className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint" data-testid="growth-squad-open">Play with a group? Start a squad</button>
      )}
      {challenge ? (
        <div className="mt-4 rounded-2xl bg-brand-surface p-4" data-testid="growth-challenge-panel">
          <p className="text-sm font-bold text-brand-ink">Your challenge is ready. Friends play the same {r.total} questions.</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(challenge.text)}`} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-[52px] items-center justify-center rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="growth-wa-send">Send on WhatsApp</a>
          <button type="button" onClick={shareCard} className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint" data-testid="growth-share-card">Share my result card</button>
          <button type="button" onClick={copyLink} className="mt-2 w-full text-center text-sm font-semibold text-brand-teal underline" data-testid="growth-copy-link">{copied ? "Link copied" : "Copy the challenge link"}</button>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-brand-surface p-4">
          <label htmlFor="growth-challenge-name" className="block text-sm font-semibold text-brand-ink">Your name for the challenge (optional)</label>
          <input id="growth-challenge-name" maxLength={NICK_MAX} autoComplete="given-name" value={myName || r.nickname || ""} onChange={(e) => setMyName(e.target.value)} placeholder="So friends know it is you" className="mt-1 min-h-[48px] w-full rounded-xl border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="growth-challenge-name" />
          {challengeError && <p className="mt-2 text-sm text-brand-rose" role="alert">{challengeError}</p>}
          <button type="button" disabled={challengeBusy} onClick={makeChallenge} className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="growth-challenge">{r.duel ? "Challenge someone yourself" : "Challenge a friend"}</button>
        </div>
      )}
      {saved ? (
        <p className="mt-3 rounded-2xl bg-brand-mint p-3 text-center text-sm font-semibold text-brand-tealDeep" role="status" data-testid="growth-saved">Saved. We will keep your {r.rank.label} rank for you.</p>
      ) : saveOpen ? (
        <form className="mt-3 rounded-2xl bg-brand-surface p-4" onSubmit={(e) => { e.preventDefault(); void save(); }} data-testid="growth-save-form">
          <label htmlFor="growth-phone" className="block text-sm font-semibold text-brand-ink">WhatsApp number</label>
          <input id="growth-phone" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 min-h-[48px] w-full rounded-xl border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" />
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-brand-ink"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="growth-consent" /><span>{CONSENT_TEXT}</span></label>
          {saveError && <p className="mt-2 text-sm text-brand-rose" role="alert">{saveError}</p>}
          <button type="submit" disabled={busy} className="mt-3 min-h-[48px] w-full rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="growth-save-submit">Save my score</button>
        </form>
      ) : (
        <button type="button" onClick={() => setSaveOpen(true)} className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint" data-testid="growth-save-open">Save my score and rank</button>
      )}
      <button type="button" onClick={playAgain} className="mt-3 w-full text-center text-sm font-semibold text-brand-teal underline">Play again</button>
      </div>
    </>
  );
}

/** The Ayakbi Arena frame around every taster screen: the stage, the brand, and the sound switch. */
function Shell({ children, rootRef, sound, onSound }: { children: React.ReactNode; rootRef: React.RefObject<HTMLDivElement>; sound: boolean; onSound: (on: boolean) => void }) {
  return (
    <div className="ga-root" ref={rootRef} onPointerDown={() => snd.wake()} data-testid="growth-arena">
      <div className="ga-wrap">
        <div className="ga-bar">
          <span className="ga-brand">Ayakbi Arena</span>
          <button type="button" className="ga-soundbtn" aria-pressed={sound} aria-label={sound ? "Sound on. Tap to turn off" : "Sound off. Tap to turn on"} onClick={() => onSound(!sound)} data-testid="growth-sound">{sound ? "🔊 Sound on" : "🔇 Sound off"}</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="mt-3 flex min-h-[52px] items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint">{children}</Link>;
}
