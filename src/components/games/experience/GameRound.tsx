"use client";
import { useEffect, useMemo, useState } from "react";
import GamePlayer, { type PlayerApi } from "@/components/games/GamePlayer";
import Companion from "@/components/games/experience/Companion";
import Confetti from "@/components/games/experience/Confetti";
import RoundHud from "@/components/games/experience/RoundHud";
import RoundIntro from "@/components/games/experience/RoundIntro";
import RoundSummary from "@/components/games/experience/RoundSummary";
import { useRound } from "@/components/games/experience/useRound";

/**
 * A 10-question round around the game player: welcome and countdown, a heads-up display, Loop beside the question, and a summary.
 * The player still grades everything through `api`; this only follows along and reacts to real results.
 */
export default function GameRound({ title, api, onExit, exitLabel, onEmpty, after, nudge }: { title: string; api: PlayerApi; onExit: () => void; exitLabel: string; onEmpty?: React.ReactNode; after?: React.ReactNode; nudge?: { afterMisses: number; render: (close: () => void) => React.ReactNode } }) {
  const r = useRound();
  // A pop-up (for example Loop pointing at the course) once someone has missed enough in a round; shown once per round.
  const [closedRound, setClosedRound] = useState(0);
  const misses = r.round.answers.filter((a) => a.outcome === "MISS").length;
  const showNudge = !!nudge && r.phase === "playing" && misses >= nudge.afterMisses && closedRound !== r.roundNo;
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
    <div>
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
  );
}
