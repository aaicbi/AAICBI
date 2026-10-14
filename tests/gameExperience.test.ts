import { describe, expect, it } from "vitest";
import { COMPLETION_MESSAGE, MESSAGES, TIER_MESSAGES, describeAnswer, finalAchievements, isRoundComplete, newAchievement, newRound, outcomeOf, pickMessage, recordAnswer, roundTotals, tierOf, type Outcome, type RoundState } from "@/lib/games/experience";

const play = (outcomes: Outcome[], size = 10): RoundState =>
  outcomes.reduce((s, o) => recordAnswer(s, { outcome: o, score: o === "FULL" ? 1 : o === "PARTIAL" ? 0.5 : 0 }, { title: "q", detail: null }), newRound(size));

describe("outcomeOf", () => {
  it("is full, partial or a miss from what the server confirmed", () => {
    expect(outcomeOf({ correct: true, score: 1 })).toBe("FULL");
    expect(outcomeOf({ correct: false, score: 0.5 })).toBe("PARTIAL");
    expect(outcomeOf({ correct: false, score: 0 })).toBe("MISS");
  });
});

describe("streaks", () => {
  it("count only fully correct answers in a row, and a partly-right answer ends them", () => {
    expect(play(["FULL", "FULL", "FULL"]).streak).toBe(3);
    expect(play(["FULL", "FULL", "PARTIAL", "FULL"]).streak).toBe(1);
    expect(play(["FULL", "FULL", "MISS", "FULL"]).streak).toBe(1);
    expect(play(["FULL", "FULL", "FULL", "MISS", "FULL"]).bestStreak).toBe(3);
  });
  it("never go past the size of the round", () => {
    const done = play(Array(10).fill("FULL"));
    expect(isRoundComplete(done)).toBe(true);
    expect(recordAnswer(done, { outcome: "FULL", score: 1 }, { title: "x", detail: null })).toBe(done);
  });
});

describe("achievements are only for things that really happened", () => {
  it("awards On a Roll at exactly 3 and Perfect Streak at exactly 5, once each", () => {
    const two = play(["FULL", "FULL"]);
    const three = recordAnswer(two, { outcome: "FULL", score: 1 }, { title: "q", detail: null });
    expect(newAchievement(two, three)?.id).toBe("ON_A_ROLL");
    const four = recordAnswer(three, { outcome: "FULL", score: 1 }, { title: "q", detail: null });
    expect(newAchievement(three, four)).toBeNull();
    const five = recordAnswer(four, { outcome: "FULL", score: 1 }, { title: "q", detail: null });
    expect(newAchievement(four, five)?.id).toBe("PERFECT_STREAK");
    const broken = play(["FULL", "FULL", "FULL", "MISS", "FULL", "FULL", "FULL"]);
    expect(broken.earned).toEqual(["ON_A_ROLL"]); // a second run of three is not a new achievement
  });
  it("gives nothing for a bad start", () => {
    expect(finalAchievements(play(["MISS", "MISS", "MISS"]))).toEqual([]);
  });
  it("awards Flawless Round only for ten of ten", () => {
    expect(finalAchievements(play(Array(10).fill("FULL"))).map((a) => a.id)).toContain("FLAWLESS_ROUND");
    expect(finalAchievements(play([...Array(9).fill("FULL"), "MISS"])).map((a) => a.id)).not.toContain("FLAWLESS_ROUND");
  });
  it("awards Accuracy Star at 90% or more of a full round, not in place of Flawless", () => {
    const nine = finalAchievements(play([...Array(9).fill("FULL"), "MISS"])).map((a) => a.id);
    expect(nine).toContain("ACCURACY_STAR");
    expect(finalAchievements(play(Array(10).fill("FULL"))).map((a) => a.id)).not.toContain("ACCURACY_STAR");
  });
  it("awards Persistence only for finishing a full round with three or more not fully right", () => {
    expect(finalAchievements(play(["FULL", "MISS", "FULL", "MISS", "FULL", "MISS", "FULL", "FULL", "FULL", "FULL"])).map((a) => a.id)).toContain("PERSISTENCE_AWARD");
    expect(finalAchievements(play(["MISS", "MISS", "MISS"])).map((a) => a.id)).not.toContain("PERSISTENCE_AWARD"); // not finished
    expect(finalAchievements(play([...Array(8).fill("FULL"), "MISS", "MISS"])).map((a) => a.id)).not.toContain("PERSISTENCE_AWARD");
  });
  it("gives no end-of-round awards for a round that ended early", () => {
    expect(finalAchievements(play(Array(6).fill("FULL"))).map((a) => a.id)).toEqual(["ON_A_ROLL", "PERFECT_STREAK"]);
  });
});

describe("the summary tells the truth", () => {
  it("counts partly-right answers by how much was right", () => {
    const t = roundTotals(play(["FULL", "PARTIAL", "MISS", "FULL"], 4));
    expect(t).toEqual({ answered: 4, full: 2, partial: 1, missed: 1, accuracy: 63 });
  });
  it("has no result before any answer", () => {
    expect(roundTotals(newRound()).accuracy).toBe(0);
  });
  it("picks a tier from accuracy", () => {
    expect([100, 90, 89, 70, 69, 40, 39, 0].map(tierOf)).toEqual(["HIGH", "HIGH", "GOOD", "GOOD", "DEVELOPING", "DEVELOPING", "STARTING", "STARTING"]);
  });
});

describe("messages", () => {
  it("never repeat the one used last", () => {
    for (let i = 0; i < 40; i++) {
      const first = pickMessage("correct");
      expect(pickMessage("correct", first, () => i / 40)).not.toBe(first);
    }
  });
  it("can be made predictable", () => {
    expect(pickMessage("welcome", null, () => 0)).toBe(MESSAGES.welcome[0]);
  });
  it("never claim a pass or a fail, and never mock", () => {
    const all = [...Object.values(MESSAGES).flat(), ...Object.values(TIER_MESSAGES).flat(), COMPLETION_MESSAGE].join(" ").toLowerCase();
    expect(all).not.toMatch(/\bpass(ed)?\b|\bfail(ed|ure)?\b|\bstupid\b|\bwrong\b|\bbad\b/);
  });
  it("keep the encouragement after a miss supportive", () => {
    expect(MESSAGES.miss.length).toBeGreaterThanOrEqual(6);
  });
});

describe("describeAnswer", () => {
  it("names the right answer only when the learner did not get it fully right", () => {
    const quiz = { format: "QUIZ", served: { question: "What starts a workflow?", options: [{ key: "A", text: "A filter" }, { key: "B", text: "A trigger" }] } };
    expect(describeAnswer(quiz, { correct: false, feedback: { correctOptionKey: "B" } }).detail).toBe("Right answer: A trigger");
    expect(describeAnswer(quiz, { correct: true, feedback: { correctOptionKey: "B" } }).detail).toBeNull();
    expect(describeAnswer({ format: "SCENARIO", served: { situation: "S" } }, { correct: false, feedback: { best: "Test first" } }).detail).toBe("Best choice: Test first");
    expect(describeAnswer({ format: "MATCHING", served: { prompt: "P" } }, { correct: false, feedback: { pairs: [{ left: "a", right: "b", ok: false }, { left: "c", right: "d", ok: true }] } }).detail).toBe("Right pairs: a → b");
    expect(describeAnswer({ format: "ORDERING", served: { prompt: "P" } }, { correct: false, feedback: { correctOrder: ["x", "y"] } }).detail).toBe("Right order: x → y");
  });
});
