"use client";
import { Check, Flame, Minus, Volume2, VolumeX, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import AnimatedNumber from "@/components/games/experience/AnimatedNumber";
import type { Outcome } from "@/lib/games/experience";

const PIP_LABEL: Record<Outcome, string> = { FULL: "correct", PARTIAL: "partly right", MISS: "not quite" };

/** The top of a round: where you are, how many you have right, your streak, and the sound switch. Every number is real. */
export default function RoundHud({ current, size, outcomes, correct, xp, streak, soundOn, onToggleSound }: { current: number; size: number; outcomes: Outcome[]; correct: number; xp: number | null; streak: number; soundOn: boolean; onToggleSound: () => void }) {
  const answered = outcomes.length;
  return (
    <div className="space-y-2 rounded-2xl bg-gradient-to-r from-brand-mint via-brand-goldLight to-brand-mint p-3" data-testid="round-hud">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="rounded-full bg-brand-action px-3 py-1 text-sm font-extrabold text-brand-onAccent shadow" data-testid="hud-question">
          Question <span className="gx-rise inline-block" key={current}>{current}</span> of {size}
        </p>
        <p className="rounded-full bg-brand-surface px-3 py-1 text-sm font-semibold text-brand-ink shadow-sm" data-testid="hud-correct">
          Correct <AnimatedNumber value={correct} className="font-semibold text-brand-ink" />
        </p>
        {xp !== null && (
          <p className="rounded-full bg-brand-gold px-3 py-1 text-sm font-semibold text-brand-onGold shadow-sm" data-testid="hud-xp">
            XP this round <AnimatedNumber value={xp} className="font-semibold text-brand-ink" />
          </p>
        )}
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Sound effects are on. Turn them off" : "Sound effects are off. Turn them on"}
          title={soundOn ? "Sound on" : "Sound off"}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gray bg-brand-surface text-brand-ink transition-colors hover:border-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
          data-testid="sound-toggle"
        >
          <Icon icon={soundOn ? Volume2 : VolumeX} size="sm" />
        </button>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-brand-surface/80 shadow-inner" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={size} aria-valuenow={answered} aria-valuetext={`${answered} of ${size} questions answered`}>
        <div className="h-full origin-left rounded-full bg-gradient-to-r from-brand-gold via-brand-green to-brand-teal transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${size === 0 ? 0 : answered / size})`, width: "100%" }} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ol className="flex items-center gap-1" aria-label="Your answers so far">
          {Array.from({ length: size }, (_, i) => {
            const o = outcomes[i];
            const isCurrent = i === current - 1 && !o;
            return (
              <li
                key={i}
                aria-label={`Question ${i + 1}: ${o ? PIP_LABEL[o] : isCurrent ? "current" : "to come"}`}
                data-outcome={o ?? (isCurrent ? "CURRENT" : "TODO")}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  o === "FULL" ? "border-brand-teal bg-brand-teal text-brand-onAccent" : o === "PARTIAL" ? "border-brand-gold bg-brand-goldLight text-brand-goldText" : o === "MISS" ? "border-brand-rose bg-brand-roseLight text-brand-rose" : isCurrent ? "border-brand-action ring-2 ring-brand-action/40" : "border-brand-gray bg-transparent"
                }`}
              >
                {o === "FULL" ? <Icon icon={Check} size="sm" /> : o === "PARTIAL" ? <Icon icon={Minus} size="sm" /> : o === "MISS" ? <Icon icon={X} size="sm" /> : null}
              </li>
            );
          })}
        </ol>
        {streak >= 2 && (
          <p key={streak} className="gx-streak inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-gold to-brand-rose px-3 py-1 text-xs font-extrabold text-brand-onAccent shadow" data-testid="hud-streak">
            <Icon icon={Flame} size="sm" /> {streak} in a row
          </p>
        )}
      </div>
    </div>
  );
}
