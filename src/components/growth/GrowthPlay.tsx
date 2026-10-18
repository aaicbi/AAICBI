"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CONSENT_TEXT, NICK_MAX, SQUAD_NAME_MAX, answerGrid } from "@/lib/growth/growthCore";
import type { PlayState } from "@/lib/growth/growth";

type State = PlayState;
export interface DuelIntro { code: string; name: string; score: number; total: number; rankLabel: string }
export interface SquadIntro { kind: "join" | "rival"; code: string; name: string; members: number; total: number; full: boolean }
interface Challenge { duelUrl: string; text: string; cardPath: string }
interface Feedback { correct: boolean; correctKey: string | null; explanation: string | null; chosen: string; next: State }

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
  const token = useRef<string | null>(null);
  const baseKey = `aaicbi.growth.${slug}`;
  // A duel link keeps its own run, so opening a friend's challenge never resumes (or overwrites) your own earlier result.
  const key = duel ? `${baseKey}.duel.${duel.code}` : squadIntro ? `${baseKey}.${squadIntro.kind}.${squadIntro.code}` : baseKey;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try { token.current = window.localStorage.getItem(key); } catch {}
    if (token.current) void begin(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { heading.current?.focus(); }, [state?.status, state && state.status === "question" ? state.index : 0, fb === null]);

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
  }, [slug, source, key, baseKey, duel, squadIntro, myName]);

  async function choose(choice: string) {
    if (!token.current || busy || fb) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/public/growth/${slug}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, choice }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "That didn't work. Please try again."); return; }
    setFb({ correct: json.correct, correctKey: json.correctKey, explanation: json.explanation, chosen: choice, next: json.state });
  }

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
    token.current = null; setState(null); setStarted(false); setFb(null); setSaved(null); setSaveOpen(false); setConsent(false); setChallenge(null); setSquadOpen(false); setSquadNameInput("");
  }

  if (ended) return <Panel><h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none font-display text-2xl font-bold text-brand-ink">This campaign has ended</h1><p className="mt-2 text-brand-ink">The free game is closed, but you can still look at the course.</p><Cta href={`/courses/${courseId}`}>See {courseTitle}</Cta></Panel>;

  if (!started || !state) {
    return (
      <Panel>
        {organizationName && <span className="inline-block rounded-full bg-brand-mint px-3 py-1 text-xs font-bold text-brand-tealDeep">{organizationName}</span>}
        {squadIntro ? (
          <div data-testid="growth-squad-intro">
            <h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none mt-3 font-display text-3xl font-extrabold leading-tight text-brand-ink [text-wrap:balance]">{squadIntro.kind === "join" ? `Join ${squadIntro.name}` : `${squadIntro.name} challenged your squad`}</h1>
            <p className="mt-3 text-base text-brand-ink">
              {squadIntro.kind === "join"
                ? `${squadIntro.members} ${squadIntro.members === 1 ? "player is" : "players are"} in, with ${squadIntro.total} points so far. Play the same 5 questions and your score counts for the squad.`
                : `They have ${squadIntro.total} points from ${squadIntro.members} ${squadIntro.members === 1 ? "player" : "players"}. Play the same 5 questions, then start your own squad and beat them.`}
            </p>
            {squadIntro.full && squadIntro.kind === "join" ? <p className="mt-3 text-sm font-semibold text-brand-rose" role="alert">This squad is full. You can still play on your own.</p> : null}
            <label htmlFor="growth-squad-intro-name" className="mt-4 block text-sm font-semibold text-brand-ink">Your name (optional)</label>
            <input id="growth-squad-intro-name" maxLength={NICK_MAX} autoComplete="given-name" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="So the squad knows it was you" className="mt-1 min-h-[48px] w-full rounded-xl border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="growth-squad-intro-name" />
          </div>
        ) : duel ? (
          <div data-testid="growth-duel-intro">
            <h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none mt-3 font-display text-3xl font-extrabold leading-tight text-brand-ink [text-wrap:balance]">{duel.name} challenged you</h1>
            <p className="mt-3 text-base text-brand-ink">{duel.name} got {duel.score}/{duel.total} ({duel.rankLabel}) on {courseTitle}. You get the same {duel.total} questions. Can you beat them?</p>
            <label htmlFor="growth-duel-name" className="mt-4 block text-sm font-semibold text-brand-ink">Your name (optional)</label>
            <input id="growth-duel-name" maxLength={NICK_MAX} autoComplete="given-name" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="So they know it was you" className="mt-1 min-h-[48px] w-full rounded-xl border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="growth-duel-name" />
          </div>
        ) : (
          <>
            <h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none mt-3 font-display text-3xl font-extrabold leading-tight text-brand-ink [text-wrap:balance]">Do you think like an AI automation builder?</h1>
            <p className="mt-3 text-base text-brand-ink">5 questions from {courseTitle}. About 90 seconds. See your rank and what to learn next. No account needed.</p>
          </>
        )}
        <button type="button" disabled={busy} onClick={() => begin(false)} className="mt-5 min-h-[52px] w-full rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="growth-start">{squadIntro ? (squadIntro.kind === "join" ? "Join the squad" : `Take on ${squadIntro.name}`) : duel ? "Take the challenge" : "Start the 5 questions"}</button>
        {error && <p className="mt-3 text-sm text-brand-rose" role="alert">{error}</p>}
        <p className="mt-3 text-center text-sm text-gray-600">Your answers are not tied to your name.</p>
      </Panel>
    );
  }

  if (state.status === "question") {
    const showing = state;
    {
      const q = showing.question;
      return (
        <Panel>
          <div className="flex items-center justify-between text-sm font-semibold text-gray-600"><span>Question {showing.index + 1} of {showing.total}</span>{showing.squadName && <span data-testid="growth-squad-label">Squad: {showing.squadName}</span>}{showing.duelAgainst && <span data-testid="growth-duel-label">Duel vs {showing.duelAgainst}</span>}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-gray/50" role="progressbar" aria-valuemin={0} aria-valuemax={showing.total} aria-valuenow={showing.index + (fb ? 1 : 0)}><div className="h-full bg-brand-action" style={{ width: `${((showing.index + (fb ? 1 : 0)) / showing.total) * 100}%` }} /></div>
          <h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none mt-4 font-display text-xl font-bold text-brand-ink [text-wrap:balance]" data-testid="growth-question">{q.text}</h1>
          <div className="mt-4 space-y-2" role="group" aria-label="Answers">
            {q.options.map((o) => {
              const picked = fb?.chosen === o.key;
              const right = fb && o.key === fb.correctKey;
              const cls = fb ? (right ? "border-brand-green bg-brand-mint text-brand-tealDeep" : picked ? "border-brand-rose bg-brand-roseLight text-brand-rose" : "border-brand-gray/60 bg-brand-surface text-brand-ink opacity-70") : "border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal";
              return <button key={o.key} type="button" disabled={busy || !!fb} onClick={() => choose(o.key)} className={`block min-h-[48px] w-full rounded-2xl border px-4 py-3 text-left text-base ${cls}`} data-testid="growth-option">{fb && right ? "✓ " : fb && picked ? "✗ " : ""}{o.text}</button>;
            })}
          </div>
          {fb && (
            <div className="mt-4 rounded-2xl bg-brand-surface p-4" aria-live="polite">
              <p className={`font-bold ${fb.correct ? "text-brand-tealDeep" : "text-brand-rose"}`}>{fb.correct ? "Correct." : "Not quite."}</p>
              {fb.explanation && <p className="mt-1 text-sm text-brand-ink">{fb.explanation}</p>}
              <button type="button" onClick={() => { setState(fb.next); setFb(null); }} className="mt-3 min-h-[48px] w-full rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="growth-next">{fb.next.status === "done" ? "See my result" : "Next question"}</button>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-brand-rose" role="alert">{error}</p>}
        </Panel>
      );
    }
  }

  const r = state;
  return (
    <Panel>
      {r.duel && (
        <div className="mb-3 rounded-2xl bg-brand-goldLight p-4 text-center text-brand-goldText" data-testid="growth-duel-headline">
          <p className="font-display text-xl font-extrabold">{r.duel.headline}</p>
          <p className="mt-1 text-sm">You {r.score}/{r.total} · {r.duel.opponentName} {r.duel.opponentScore}/{r.duel.opponentTotal}</p>
        </div>
      )}
      <div className="rounded-2xl bg-brand-surface p-5 text-center">
        <span className="inline-block rounded-full bg-brand-goldLight px-3 py-1 text-xs font-bold text-brand-goldText" data-testid="growth-rank">{r.rank.label}</span>
        <h1 ref={heading} tabIndex={-1} className="outline-none focus-visible:outline-none mt-2 font-display text-5xl font-extrabold text-brand-ink" data-testid="growth-score">{r.score}/{r.total}</h1>
        <p className="mt-2 text-2xl" aria-label={`${r.grid.filter(Boolean).length} correct out of ${r.total}`}>{answerGrid(r.grid)}</p>
        {r.beatPercent !== null && <p className="mt-2 text-sm text-brand-ink">You beat {r.beatPercent}% of players.</p>}
      </div>
      {r.weakSpot && (
        <div className="mt-3 rounded-2xl bg-brand-goldLight p-4 text-brand-goldText"><p className="text-sm font-bold">You missed a question on: {r.weakSpot}</p><p className="mt-1 text-sm">That is part of Module 1 of {courseTitle}.</p></div>
      )}
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
      <Link href={`/play/${slug}/continue`} className="mt-3 flex min-h-[52px] items-center justify-center rounded-full bg-brand-gold px-6 text-base font-bold text-brand-onGold hover:opacity-90" data-testid="growth-continue">Start Module 1, free</Link>
      <Cta href={`/courses/${courseId}`}>See {courseTitle}</Cta>
      <button type="button" onClick={playAgain} className="mt-3 w-full text-center text-sm font-semibold text-brand-teal underline">Play again</button>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-md rounded-3xl border border-brand-gray/60 bg-card-gradient p-5 shadow-sm sm:p-7">{children}</section>;
}
function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="mt-3 flex min-h-[52px] items-center justify-center rounded-full border border-brand-action px-6 text-base font-semibold text-brand-action hover:bg-brand-mint">{children}</Link>;
}
