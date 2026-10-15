"use client";
import { useEffect, useMemo, useState } from "react";
import GamePlayer, { type PlayerApi } from "@/components/games/GamePlayer";
import Companion from "@/components/games/experience/Companion";
import Confetti from "@/components/games/experience/Confetti";
import RoundHud from "@/components/games/experience/RoundHud";
import RoundIntro from "@/components/games/experience/RoundIntro";
import RoundSummary from "@/components/games/experience/RoundSummary";
import { useRound } from "@/components/games/experience/useRound";
import { roundTotals } from "@/lib/games/experience";
import { Gamepad2, Sparkles, Star, Trophy, Zap } from "lucide-react";

/**
 * A 10-question round around the game player: welcome and countdown, a heads-up display, Loop beside the question, and a summary.
 * The player still grades everything through `api`; this only follows along and reacts to real results.
 */
export default function GameRound({ title, api, onExit, exitLabel, onEmpty, after, nudge }: { title: string; api: PlayerApi; onExit: () => void; exitLabel: string; onEmpty?: React.ReactNode; after?: React.ReactNode; nudge?: { failBelow: number; render: (close: () => void) => React.ReactNode } }) {
  const r = useRound();
  // A pop-up (for example Loop pointing at the course) for a finished round that went badly (accuracy below `failBelow`). Never during
  // play: it waits a moment after the results appear so the learner sees their result first, and shows once per round.
  const [closedRound, setClosedRound] = useState(0);
  const [late, setLate] = useState(false);
  const roundDone = r.phase === "summary" && r.round.answers.length >= r.round.size;
  const failed = roundDone && roundTotals(r.round).accuracy < (nudge?.failBelow ?? 0);
  useEffect(() => {
    setLate(false);
    if (!failed) return;
    const t = setTimeout(() => setLate(true), 1600);
    return () => clearTimeout(t);
  }, [failed, r.roundNo]);
  const showNudge = !!nudge && failed && late && closedRound !== r.roundNo;
  useEffect(() => {
    if (showNudge) r.sound.play("start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNudge]);

  const hooks = useMemo(
    () => ({
      onResult: (item: Parameters<typeof r.report>[0]["item"] & { playId: string }, result: Parameters<typeof r.report>[0]["result"]) => r.report({ key: item.playId, item, result }),
      onAdvance: r.advance,
      onDone: r.finishEarly,
      onInteract: () => r.sound.play("select"),
      nextLabel: r.round.answers.length >= r.round.size ? "See my results" : "Next question",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r.report, r.advance, r.finishEarly, r.sound.play, r.round.answers.length, r.round.size],
  );

  return (
    <div className="gx-stage ad-banner relative overflow-hidden rounded-3xl p-2 shadow-lg sm:p-3" data-testid="game-stage">
      <span className="ad-shine" aria-hidden="true" />
      <span className="ad-float pointer-events-none absolute right-4 top-2 text-[#F2B84B]" aria-hidden="true"><Trophy className="h-6 w-6" /></span>
      <span className="ad-float pointer-events-none absolute right-16 top-3 text-white/80" style={{ animationDelay: "-1.4s" }} aria-hidden="true"><Star className="h-4 w-4" /></span>
      <span className="ad-twinkle pointer-events-none absolute right-28 top-4 text-white" aria-hidden="true"><Sparkles className="h-4 w-4" /></span>
      <span className="ad-float pointer-events-none absolute left-1/2 top-3 hidden text-[#F2B84B]/80 sm:block" style={{ animationDelay: "-2.2s" }} aria-hidden="true"><Zap className="h-4 w-4" /></span>
      <div className="relative flex items-center gap-2 px-2 pb-2 pt-1 text-white">
        <Gamepad2 className="h-5 w-5 shrink-0 text-[#F2B84B]" aria-hidden="true" />
        <p className="min-w-0 max-w-[55%] truncate text-xs font-extrabold uppercase tracking-wider sm:text-sm">{title}</p>
        <span className="rounded-full bg-[#F2B84B] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#2A1D00]">Round {r.roundNo}</span>
      </div>
      <div className="relative rounded-2xl bg-brand-surface p-4 text-brand-ink sm:p-5">
        <Confetti burst={r.confetti.burst} strength={r.confetti.strength} />
        {showNudge && nudge.render(() => setClosedRound(r.roundNo))}
        {r.phase === "intro" && <RoundIntro title={title} size={r.round.size} roundNo={r.roundNo} welcome={r.message} countdown={r.countdown} onStart={r.start} onReady={r.ready} />}
        {r.phase === "playing" && (
          <div className="space-y-4">
            <RoundHud
              current={r.current}
              size={r.round.size}
              outcomes={r.round.answers.map((a) => a.outcome)}
              correct={r.round.answers.filter((a) => a.outcome === "FULL").length}
              xp={r.xp}
              streak={r.round.streak}
              soundOn={r.sound.enabled}
              onToggleSound={r.sound.toggle}
            />
            <Companion mood={r.mood} message={r.message} messageKey={r.messageKey} achievement={r.achievement} />
            <GamePlayer key={r.roundNo} api={api} mode="play" onEmpty={onEmpty} hooks={hooks} />
          </div>
        )}
        {r.phase === "summary" && (
          <>
            <RoundSummary round={r.round} xp={r.xp} onAgain={r.again} onExit={onExit} exitLabel={exitLabel} />
            {after}
          </>
        )}
      </div>
    </div>
  );
}
