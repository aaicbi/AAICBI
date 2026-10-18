"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WHATSAPP_TEXT, answerGrid } from "@/lib/growth/growthCore";

type Q = { id: string; text: string; options: { key: string; text: string }[] };
type State =
  | { status: "question"; index: number; total: number; question: Q }
  | { status: "done"; score: number; total: number; rank: { key: string; label: string }; grid: boolean[]; weakSpot: string | null; beatPercent: number | null };
interface Feedback { correct: boolean; correctKey: string | null; explanation: string | null; chosen: string; next: State }

/** The public taster: five questions, no account. The browser keeps only a random token so a refresh does not lose the run. */
export default function GrowthPlay({ slug, courseId, courseTitle, organizationName, source, shareUrl }: { slug: string; courseId: string; courseTitle: string; organizationName: string | null; source: string | null; shareUrl: string }) {
  const [state, setState] = useState<State | null>(null);
  const [started, setStarted] = useState(false);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const token = useRef<string | null>(null);
  const key = `aaicbi.growth.${slug}`;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try { token.current = window.localStorage.getItem(key); } catch {}
    if (token.current) void begin(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { heading.current?.focus(); }, [state?.status, state && state.status === "question" ? state.index : 0, fb === null]);

  const begin = useCallback(async (resume = false) => {
    setBusy(true); setError(null);
    const res = await fetch(`/api/public/growth/${slug}/play`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resume ? token.current : null, source }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 410) { setEnded(true); return; }
    if (!res.ok) {
      if (resume) { try { window.localStorage.removeItem(key); } catch {} token.current = null; return; }
      setError(json.error ?? "That didn't work. Please try again.");
      return;
    }
    token.current = json.token;
    try { window.localStorage.setItem(key, json.token); } catch {}
    setState(json.state); setStarted(true); setFb(null);
  }, [slug, source, key]);

  async function choose(choice: string) {
    if (!token.current || busy || fb) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/public/growth/${slug}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, choice }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? "That didn't work. Please try again."); return; }
    setFb({ correct: json.correct, correctKey: json.correctKey, explanation: json.explanation, chosen: choice, next: json.state });
  }

  function playAgain() {
    try { window.localStorage.removeItem(key); } catch {}
    token.current = null; setState(null); setStarted(false); setFb(null);
  }

  if (ended) return <Panel><h1 ref={heading} tabIndex={-1} className="outline-none font-display text-2xl font-bold text-brand-ink">This campaign has ended</h1><p className="mt-2 text-brand-ink">The free game is closed, but you can still look at the course.</p><Cta href={`/courses/${courseId}`}>See {courseTitle}</Cta></Panel>;

  if (!started || !state) {
    return (
      <Panel>
        {organizationName && <span className="inline-block rounded-full bg-brand-mint px-3 py-1 text-xs font-bold text-brand-tealDeep">{organizationName}</span>}
        <h1 ref={heading} tabIndex={-1} className="outline-none mt-3 font-display text-3xl font-extrabold leading-tight text-brand-ink [text-wrap:balance]">Do you think like an AI automation builder?</h1>
        <p className="mt-3 text-base text-brand-ink">5 questions from {courseTitle}. About 90 seconds. See your rank and what to learn next. No account needed.</p>
        <button type="button" disabled={busy} onClick={() => begin(false)} className="mt-5 min-h-[52px] w-full rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="growth-start">Start the 5 questions</button>
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
          <div className="flex items-center justify-between text-sm font-semibold text-gray-600"><span>Question {showing.index + 1} of {showing.total}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-gray/50" role="progressbar" aria-valuemin={0} aria-valuemax={showing.total} aria-valuenow={showing.index + (fb ? 1 : 0)}><div className="h-full bg-brand-action" style={{ width: `${((showing.index + (fb ? 1 : 0)) / showing.total) * 100}%` }} /></div>
          <h1 ref={heading} tabIndex={-1} className="outline-none mt-4 font-display text-xl font-bold text-brand-ink [text-wrap:balance]" data-testid="growth-question">{q.text}</h1>
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
  const text = WHATSAPP_TEXT(r.score, r.total, shareUrl);
  return (
    <Panel>
      <div className="rounded-2xl bg-brand-surface p-5 text-center">
        <span className="inline-block rounded-full bg-brand-goldLight px-3 py-1 text-xs font-bold text-brand-goldText" data-testid="growth-rank">{r.rank.label}</span>
        <h1 ref={heading} tabIndex={-1} className="outline-none mt-2 font-display text-5xl font-extrabold text-brand-ink" data-testid="growth-score">{r.score}/{r.total}</h1>
        <p className="mt-2 text-2xl" aria-label={`${r.grid.filter(Boolean).length} correct out of ${r.total}`}>{answerGrid(r.grid)}</p>
        {r.beatPercent !== null && <p className="mt-2 text-sm text-brand-ink">You beat {r.beatPercent}% of players.</p>}
      </div>
      {r.weakSpot && (
        <div className="mt-3 rounded-2xl bg-brand-goldLight p-4 text-brand-goldText"><p className="text-sm font-bold">You missed a question on: {r.weakSpot}</p><p className="mt-1 text-sm">That is part of Module 1 of {courseTitle}.</p></div>
      )}
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-[52px] items-center justify-center rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="growth-share">Challenge a friend on WhatsApp</a>
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
