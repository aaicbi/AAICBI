"use client";
import { useEffect, useState } from "react";
import { Check, Minus, Trophy, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import LoopFace from "@/components/guide/LoopFace";
import { COMPLETION_MESSAGE, TIER_MESSAGES, finalAchievements, roundTotals, tierOf, type RoundState } from "@/lib/games/experience";

const R = 42;
const C = 2 * Math.PI * R;

/**
 * The end of a round: the real result, a message that fits it (never a pass or a fail: practice has neither), any achievements
 * actually earned, the answers to review, and what to do next.
 */
export default function RoundSummary({ round, xp, onAgain, onExit, exitLabel }: { round: RoundState; xp: number | null; onAgain: () => void; onExit: () => void; exitLabel: string }) {
  const totals = roundTotals(round);
  const tier = tierOf(totals.accuracy);
  const achievements = finalAchievements(round);
  const [review, setReview] = useState(false);
  const [message] = useState(() => TIER_MESSAGES[tier][0]);

  useEffect(() => {
    document.getElementById("round-summary-heading")?.focus();
  }, []);

  return (
    <div className="gx-rise space-y-5" data-testid="round-summary" data-tier={tier}>
      <div className="ad-banner flex flex-col items-center gap-3 rounded-2xl p-4 text-center text-white sm:flex-row sm:text-left">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-white/30" />
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round" className="gx-draw stroke-[#F2B84B]" style={{ strokeDasharray: C, strokeDashoffset: C, ["--gx-to" as string]: C * (1 - totals.accuracy / 100) }} />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-white" data-testid="summary-accuracy">
            {totals.accuracy}%
          </p>
        </div>
        <div className="min-w-0">
          <h2 id="round-summary-heading" tabIndex={-1} className="font-display text-2xl font-extrabold text-white outline-none">
            Round complete
          </h2>
          <p className="mt-0.5 text-sm font-medium text-white/95" data-testid="summary-count">
            {totals.full} of {totals.answered} fully correct
            {totals.partial > 0 ? `, ${totals.partial} partly right` : ""}
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2 text-xs sm:justify-start">
            <li className="inline-flex items-center gap-1 rounded-full bg-brand-mint px-2.5 py-1 text-brand-ink"><Icon icon={Check} size="sm" /> {totals.full} correct</li>
            {totals.partial > 0 && <li className="inline-flex items-center gap-1 rounded-full bg-brand-goldLight px-2.5 py-1 text-brand-goldText"><Icon icon={Minus} size="sm" /> {totals.partial} partly right</li>}
            <li className="inline-flex items-center gap-1 rounded-full bg-brand-roseLight/70 px-2.5 py-1 text-brand-rose"><Icon icon={X} size="sm" /> {totals.missed} to revisit</li>
            {round.bestStreak >= 2 && <li className="rounded-full bg-brand-goldLight px-2.5 py-1 text-brand-goldText">Best streak: {round.bestStreak}</li>}
            {xp !== null && xp > 0 && <li className="rounded-full bg-brand-gold px-2.5 py-1 font-semibold text-brand-onGold">+{xp} XP</li>}
          </ul>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-brand-surface p-3">
        <LoopFace state={tier === "HIGH" || tier === "GOOD" ? "helpful" : "speaking"} size={44} />
        <div className="text-sm text-brand-ink">
          <p data-testid="summary-message">{message}</p>
          <p className="mt-1 text-xs text-gray-600">{COMPLETION_MESSAGE}</p>
        </div>
      </div>

      {achievements.length > 0 && (
        <ul className="space-y-2" aria-label="Achievements earned this round" data-testid="summary-achievements">
          {achievements.map((a, i) => (
            <li key={a.id} className="gx-badge flex items-center gap-3 rounded-2xl border border-brand-gold bg-brand-goldLight px-3 py-2 text-brand-goldText" style={{ animationDelay: `${0.35 + i * 0.15}s` }} data-achievement={a.id}>
              <Icon icon={Trophy} size="md" />
              <span className="text-sm">
                <span className="font-semibold">Achievement unlocked: {a.title}</span>
                <span className="block text-xs">{a.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button type="button" aria-expanded={review} onClick={() => setReview((v) => !v)} className="text-sm font-semibold text-brand-teal underline" data-testid="review-toggle">
          {review ? "Hide my answers" : "Review my answers"}
        </button>
        {review && (
          <ol className="mt-2 space-y-2" data-testid="review-list">
            {round.review.map((r, i) => (
              <li key={i} className="rounded-xl border border-brand-gray bg-brand-surface px-3 py-2 text-sm" data-outcome={r.outcome}>
                <p className="flex items-start gap-2 text-brand-ink">
                  <span className="mt-0.5 shrink-0"><Icon icon={r.outcome === "FULL" ? Check : r.outcome === "PARTIAL" ? Minus : X} size="sm" label={r.outcome === "FULL" ? "Correct" : r.outcome === "PARTIAL" ? "Partly right" : "Not quite"} /></span>
                  <span>
                    <span className="font-medium">{i + 1}. {r.title}</span>
                    {r.detail && <span className="mt-0.5 block text-xs text-gray-700">{r.detail}</span>}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onAgain} data-testid="round-again">
          Play another round
        </Button>
        <Button variant="secondary" onClick={onExit} data-testid="round-exit">
          {exitLabel}
        </Button>
      </div>
    </div>
  );
}
