/**
 * The game experience's rules, kept pure so they can be tested without a screen: what counts as a round, a streak and an
 * achievement, which message Loop says, and how a finished round is summed up.
 *
 * Nothing here changes scoring. It only reads the results the server has already confirmed (correct, partly right, wrong) and
 * turns them into what the learner sees. Every number shown comes from those results; nothing is invented, and an achievement
 * is only ever awarded for something that really happened in the round.
 */

export const ROUND_SIZE = 10;

export type Outcome = "FULL" | "PARTIAL" | "MISS";

export type AchievementId = "ON_A_ROLL" | "PERFECT_STREAK" | "FLAWLESS_ROUND" | "ACCURACY_STAR" | "PERSISTENCE_AWARD";

export interface Achievement {
  id: AchievementId;
  title: string;
  /** What the learner actually did, in plain words. */
  detail: string;
  /** A bigger moment gets a bigger celebration. */
  major: boolean;
}

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  ON_A_ROLL: { id: "ON_A_ROLL", title: "On a Roll", detail: "3 correct in a row", major: false },
  PERFECT_STREAK: { id: "PERFECT_STREAK", title: "Perfect Streak", detail: "5 correct in a row", major: true },
  FLAWLESS_ROUND: { id: "FLAWLESS_ROUND", title: "Flawless Round", detail: "Every question in the round right", major: true },
  ACCURACY_STAR: { id: "ACCURACY_STAR", title: "Accuracy Star", detail: "90% or more in a full round", major: true },
  PERSISTENCE_AWARD: { id: "PERSISTENCE_AWARD", title: "Persistence Award", detail: "Finished a full round, even with some misses", major: false },
};

export interface ReviewLine {
  outcome: Outcome;
  title: string;
  /** What the right answer was, when the learner did not get it fully right. */
  detail: string | null;
}

export interface RoundState {
  size: number;
  answers: { outcome: Outcome; score: number }[];
  review: ReviewLine[];
  /** Consecutive fully-correct answers right now. */
  streak: number;
  bestStreak: number;
  earned: AchievementId[];
}

export function newRound(size: number = ROUND_SIZE): RoundState {
  return { size, answers: [], review: [], streak: 0, bestStreak: 0, earned: [] };
}

export function outcomeOf(result: { correct: boolean; score: number }): Outcome {
  if (result.correct) return "FULL";
  return result.score > 0 ? "PARTIAL" : "MISS";
}

/** Adds one confirmed answer. A partly-right answer ends a streak: only fully correct answers extend it. */
export function recordAnswer(state: RoundState, answer: { outcome: Outcome; score: number }, line: { title: string; detail: string | null }): RoundState {
  if (state.answers.length >= state.size) return state;
  const streak = answer.outcome === "FULL" ? state.streak + 1 : 0;
  const earned = [...state.earned];
  if (streak === 3 && !earned.includes("ON_A_ROLL")) earned.push("ON_A_ROLL");
  if (streak === 5 && !earned.includes("PERFECT_STREAK")) earned.push("PERFECT_STREAK");
  return {
    ...state,
    answers: [...state.answers, answer],
    review: [...state.review, { outcome: answer.outcome, title: line.title, detail: line.detail }],
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    earned,
  };
}

export const isRoundComplete = (s: RoundState) => s.answers.length >= s.size;

/** The achievement this answer just earned, if any (a new one only; never repeated). */
export function newAchievement(prev: RoundState, next: RoundState): Achievement | null {
  const id = next.earned.find((e) => !prev.earned.includes(e));
  return id ? ACHIEVEMENTS[id] : null;
}

export interface RoundTotals {
  answered: number;
  full: number;
  partial: number;
  missed: number;
  /** Partly-right answers count by how much of them was right. 0 to 100. */
  accuracy: number;
}

export function roundTotals(s: RoundState): RoundTotals {
  const answered = s.answers.length;
  const full = s.answers.filter((a) => a.outcome === "FULL").length;
  const partial = s.answers.filter((a) => a.outcome === "PARTIAL").length;
  const sum = s.answers.reduce((n, a) => n + a.score, 0);
  return { answered, full, partial, missed: answered - full - partial, accuracy: answered === 0 ? 0 : Math.round((sum / answered) * 100) };
}

export type Tier = "HIGH" | "GOOD" | "DEVELOPING" | "STARTING";

export function tierOf(accuracy: number): Tier {
  if (accuracy >= 90) return "HIGH";
  if (accuracy >= 70) return "GOOD";
  if (accuracy >= 40) return "DEVELOPING";
  return "STARTING";
}

/** Everything earned in a round: moments along the way, plus what the finished round shows. Only for a full round. */
export function finalAchievements(s: RoundState): Achievement[] {
  const out = s.earned.map((id) => ACHIEVEMENTS[id]);
  if (!isRoundComplete(s)) return out;
  const t = roundTotals(s);
  const add = (id: AchievementId) => out.some((a) => a.id === id) || out.push(ACHIEVEMENTS[id]);
  if (t.full === s.size) add("FLAWLESS_ROUND");
  else if (t.accuracy >= 90) add("ACCURACY_STAR");
  if (t.full < s.size && t.answered - t.full >= 3) add("PERSISTENCE_AWARD");
  return out;
}

// ---------------------------------------------------------------------------
// Words. Warm, adult, never mocking. Nothing here claims a pass or a fail: practice has neither.
// ---------------------------------------------------------------------------

export type MessageKind = "welcome" | "firstQuestion" | "correct" | "partial" | "miss" | "streak3" | "streak5" | "halfway" | "lastQuestion" | "tryAgain";

export const MESSAGES: Record<MessageKind, string[]> = {
  welcome: [
    "Welcome, Champion! Are you ready to challenge yourself?",
    "Your next breakthrough starts here!",
    "Let's see what you know. Every question is an opportunity to grow!",
    "Ready to unlock your potential? Let's go!",
  ],
  firstQuestion: ["Take your time and read every option.", "No rush. Think it through.", "Here we go. You've got this!"],
  correct: [
    "Brilliant! You got it right!",
    "Excellent work! Keep that momentum going!",
    "Outstanding! You're mastering this!",
    "Yes! Another victory!",
    "Fantastic thinking!",
    "You're getting stronger with every question!",
    "That's the spirit! Keep going!",
    "Knowledge unlocked!",
    "Another step towards mastery!",
  ],
  partial: ["So close! Part of that was right.", "Nearly there. You had some of it.", "Good progress. Take a look at the part to fix."],
  miss: [
    "Not quite, but you're learning!",
    "Keep going! Every mistake can teach you something.",
    "Don't give up. Your next answer could be the one!",
    "Learning takes practice. You've got this!",
    "One question doesn't define your ability.",
    "Review, learn, and come back stronger!",
    "You're building knowledge one step at a time.",
    "Stay focused. Champions keep learning!",
  ],
  streak3: ["Three in a row. You're on fire!", "That's three correct in a row. Keep it going!"],
  streak5: ["Five in a row! Remarkable focus!", "Five correct in a row. That's real momentum!"],
  halfway: ["Halfway there. Keep going!", "Half the round done. You're doing well."],
  lastQuestion: ["Last one. Finish strong!", "One more to go. Give it your best."],
  tryAgain: ["Another round? Every attempt builds understanding.", "Ready for another go? You've got this."],
};

/** Picks a message at random, never the one used last time. `rand` can be passed in to make it predictable in tests. */
export function pickMessage(kind: MessageKind, avoid: string | null = null, rand: () => number = Math.random): string {
  const pool = MESSAGES[kind];
  const options = pool.length > 1 && avoid ? pool.filter((m) => m !== avoid) : pool;
  return options[Math.min(options.length - 1, Math.floor(rand() * options.length))];
}

export const TIER_MESSAGES: Record<Tier, string[]> = {
  HIGH: ["Outstanding achievement! Your hard work is paying off!"],
  GOOD: ["Great effort! You're building real understanding."],
  DEVELOPING: ["Every attempt is a learning opportunity. Review what you've learned and keep moving forward."],
  STARTING: ["That was a tough round, and that's how learning works. Look back at what you missed, then try again when you're ready."],
};

export const COMPLETION_MESSAGE = "You showed up, challenged yourself, and completed the round. Keep growing!";

// ---------------------------------------------------------------------------
// Describing an answer for the review list, from what the server sent back.
// ---------------------------------------------------------------------------

interface ReviewItem {
  format: string;
  served: Record<string, unknown>;
}
interface ReviewResult {
  correct: boolean;
  feedback: Record<string, unknown>;
}

const clip = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** A short title and, when the answer was not fully right, what the right answer was. */
export function describeAnswer(item: ReviewItem, result: ReviewResult): { title: string; detail: string | null } {
  const s = item.served as { question?: string; situation?: string; prompt?: string; options?: unknown };
  const f = result.feedback as { correctOptionKey?: string | null; best?: string; pairs?: { left: string; right: string; ok: boolean }[]; correctOrder?: string[] };
  if (item.format === "QUIZ") {
    const options = (s.options as { key: string; text: string }[] | undefined) ?? [];
    const right = options.find((o) => o.key === f.correctOptionKey)?.text;
    return { title: clip(s.question ?? "Question"), detail: !result.correct && right ? `Right answer: ${right}` : null };
  }
  if (item.format === "SCENARIO") return { title: clip(s.situation ?? "Scenario"), detail: !result.correct && f.best ? `Best choice: ${f.best}` : null };
  if (item.format === "MATCHING") {
    const wrong = (f.pairs ?? []).filter((p) => !p.ok).map((p) => `${p.left} → ${p.right}`);
    return { title: clip(s.prompt ?? "Matching"), detail: !result.correct && wrong.length ? `Right pairs: ${wrong.join("; ")}` : null };
  }
  return { title: clip(s.prompt ?? "Put in order"), detail: !result.correct && f.correctOrder ? `Right order: ${f.correctOrder.join(" → ")}` : null };
}
