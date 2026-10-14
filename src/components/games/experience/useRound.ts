"use client";
import { useCallback, useRef, useState } from "react";
import { COMPLETION_MESSAGE, TIER_MESSAGES, describeAnswer, isRoundComplete, newAchievement, newRound, outcomeOf, pickMessage, recordAnswer, roundTotals, tierOf, type Achievement, type MessageKind, type RoundState } from "@/lib/games/experience";
import { useGameSound } from "@/components/games/experience/useGameSound";
import type { Mood } from "@/components/games/experience/Companion";

const COUNTDOWN_FLAG = "aaicbi.game.countdown";

export interface ReportedAnswer {
  /** A key that is the same for the same answer, so a repeated report is counted once. */
  key: string;
  item: { format: string; served: Record<string, unknown> };
  result: { correct: boolean; score: number; feedback: Record<string, unknown>; xp?: { earned: number } };
}

export type Phase = "intro" | "playing" | "summary";

/**
 * The state of one 10-question round. It only ever reflects answers the server has actually graded: nothing here decides
 * correctness, scoring or XP. The companion, sounds and confetti are all reactions to those real results.
 */
export function useRound() {
  const sound = useGameSound();
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState<RoundState>(() => newRound());
  const [roundNo, setRoundNo] = useState(1);
  const [answered, setAnswered] = useState(false);
  const [xp, setXp] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood>("hello");
  const [message, setMessage] = useState(() => pickMessage("welcome"));
  const [messageKey, setMessageKey] = useState(0);
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [confetti, setConfetti] = useState<{ burst: number; strength: "small" | "big" }>({ burst: 0, strength: "small" });
  const seen = useRef<Set<string>>(new Set());
  const last = useRef<string | null>(null);
  const roundRef = useRef(round);
  roundRef.current = round;

  const say = useCallback((kind: MessageKind, m: Mood) => {
    const text = pickMessage(kind, last.current);
    last.current = text;
    setMessage(text);
    setMood(m);
    setMessageKey((n) => n + 1);
  }, []);

  const celebrate = useCallback((strength: "small" | "big") => setConfetti((c) => ({ burst: c.burst + 1, strength })), []);

  /** True the first time in a visit, so the 3-2-1 plays once and later rounds go straight in. */
  const [countdown] = useState(() => {
    try {
      return window.sessionStorage.getItem(COUNTDOWN_FLAG) !== "1";
    } catch {
      return true;
    }
  });

  const start = useCallback(() => sound.unlock(), [sound]);
  const ready = useCallback(() => {
    try {
      window.sessionStorage.setItem(COUNTDOWN_FLAG, "1");
    } catch {}
    sound.play("start");
    setPhase("playing");
    say("firstQuestion", "hello");
  }, [say, sound]);

  const report = useCallback(
    (a: ReportedAnswer) => {
      if (seen.current.has(a.key)) return;
      seen.current.add(a.key);
      const prev = roundRef.current;
      const outcome = outcomeOf(a.result);
      const next = recordAnswer(prev, { outcome, score: a.result.score }, describeAnswer(a.item, a.result));
      if (next === prev) return;
      setRound(next);
      setAnswered(true);
      if (a.result.xp) setXp((n) => (n ?? 0) + a.result.xp!.earned);
      const got = newAchievement(prev, next);
      setAchievement(got);
      if (outcome === "FULL") {
        if (next.streak === 5) {
          say("streak5", "cheerBig");
          sound.play("achievement");
          celebrate("big");
        } else if (next.streak === 3) {
          say("streak3", "cheer");
          sound.play("streak");
          celebrate("small");
        } else {
          say("correct", "cheer");
          sound.play("correct");
        }
      } else if (outcome === "PARTIAL") {
        say("partial", "support");
        sound.play("select");
      } else {
        say("miss", "support");
        sound.play("wrong");
      }
    },
    [celebrate, say, sound],
  );

  /** Moves on from the answer on screen. True when that was the last question, so the caller should not load another. */
  const advance = useCallback((): boolean => {
    const r = roundRef.current;
    setAnswered(false);
    setAchievement(null);
    if (isRoundComplete(r)) {
      finish(r);
      return true;
    }
    const n = r.answers.length;
    if (n === Math.floor(r.size / 2)) say("halfway", "hello");
    else if (n === r.size - 1) say("lastQuestion", "hello");
    else setMood("idle");
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say]);

  function finish(r: RoundState) {
    setPhase("summary");
    const tier = tierOf(roundTotals(r).accuracy);
    const text = r.answers.length >= r.size ? TIER_MESSAGES[tier][0] : COMPLETION_MESSAGE;
    last.current = text;
    setMessage(text);
    setMood(tier === "HIGH" ? "cheerBig" : tier === "GOOD" ? "cheer" : "support");
    setMessageKey((n) => n + 1);
    sound.play("complete");
    if (tier === "HIGH") celebrate("big");
    else if (tier === "GOOD") celebrate("small");
  }

  /** Stops early (nothing left to play). Shows the summary for what was answered, or goes back if nothing was. */
  const finishEarly = useCallback(() => {
    const r = roundRef.current;
    if (r.answers.length === 0) return false;
    setAnswered(false);
    finish(r);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const again = useCallback(() => {
    seen.current = new Set();
    setRound(newRound());
    setAnswered(false);
    setAchievement(null);
    setXp(null);
    setRoundNo((n) => n + 1);
    setPhase("playing");
    say("firstQuestion", "hello");
  }, [say]);

  const reset = useCallback(() => {
    seen.current = new Set();
    setRound(newRound());
    setAnswered(false);
    setAchievement(null);
    setXp(null);
    setPhase("intro");
    setMood("hello");
    setMessage(pickMessage("welcome"));
    setMessageKey((n) => n + 1);
  }, []);

  const current = Math.min(round.size, round.answers.length + (answered ? 0 : 1));

  return { phase, round, roundNo, current, answered, xp, mood, message, messageKey, achievement, confetti, countdown, sound, start, ready, report, advance, finishEarly, again, reset };
}
