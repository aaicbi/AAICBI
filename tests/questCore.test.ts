import { describe, expect, it } from "vitest";
import {
  ALL_REWARDS,
  QUEST_DEFAULTS,
  dayKey,
  drawFormal,
  isFormalEligible,
  levelFor,
  masteryFor,
  minAnswerSeconds,
  pickObjective,
  pickQuestion,
  poolCoverage,
  streakLength,
  streakXp,
  suggestSplit,
  xpForAnswer,
  type AnswerRecord,
  type RewardKind,
  type XpAnswerContext,
} from "@/lib/quest/core";

const T0 = new Date("2026-10-01T10:00:00Z");
const day = (n: number, hour = 10) => new Date(T0.getTime() + n * 86_400_000 + (hour - 10) * 3_600_000);
const ans = (q: string, correct: boolean, when: Date, tooFast = false): AnswerRecord => ({
  questionId: q,
  correct,
  answeredAt: when,
  tooFast,
});

describe("dayKey and streaks", () => {
  it("uses Nigeria time (UTC+1) for day boundaries", () => {
    expect(dayKey(new Date("2026-10-01T22:59:00Z"))).toBe("2026-10-01");
    expect(dayKey(new Date("2026-10-01T23:01:00Z"))).toBe("2026-10-02");
  });
  it("counts consecutive days ending today", () => {
    const days = new Set(["2026-10-03", "2026-10-02", "2026-10-01", "2026-09-29"]);
    expect(streakLength(days, "2026-10-03")).toBe(3);
    expect(streakLength(days, "2026-10-04")).toBe(0);
    expect(streakLength(new Set(["2026-10-03"]), "2026-10-03")).toBe(1);
  });
});

describe("minAnswerSeconds", () => {
  it("is 3 seconds for a short question", () => {
    expect(minAnswerSeconds("What is an API?")).toBe(3);
  });
  it("scales with length: 40 words need 10 seconds", () => {
    const text = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    expect(minAnswerSeconds(text)).toBe(10);
  });
});

describe("masteryFor", () => {
  it("is NOT_STARTED with no answers", () => {
    const r = masteryFor([], T0);
    expect(r.state).toBe("NOT_STARTED");
    expect(r.progress).toBe(0);
  });

  it("is LEARNING after a few correct answers on one day", () => {
    const r = masteryFor([ans("q1", true, day(0)), ans("q2", true, day(0))], day(0));
    expect(r.state).toBe("LEARNING");
    expect(r.distinctCorrect).toBe(2);
    expect(r.needs.length).toBeGreaterThan(0);
  });

  it("is NEARLY_THERE when two of the three criteria are met", () => {
    // 6 distinct correct and 100% accuracy, but all on one day.
    const answers = ["q1", "q2", "q3", "q4", "q5", "q6"].map((q) => ans(q, true, day(0)));
    const r = masteryFor(answers, day(0));
    expect(r.state).toBe("NEARLY_THERE");
    expect(r.needs).toEqual(["practice on 2 separate days"]);
  });

  it("is MASTERED with 6 different correct, 80% over the last 10, across 2 days", () => {
    const answers = [
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5", "q6"].map((q) => ans(q, true, day(1))),
    ];
    const r = masteryFor(answers, day(1));
    expect(r.state).toBe("MASTERED");
    expect(r.progress).toBe(1);
    expect(r.needs).toEqual([]);
  });

  it("repeating the same question does not build mastery", () => {
    const answers = Array.from({ length: 8 }, (_, i) => ans("q1", true, day(i % 3, 10 + i)));
    const r = masteryFor(answers, day(3));
    expect(r.distinctCorrect).toBe(1);
    expect(r.state).not.toBe("MASTERED");
  });

  it("a too-fast correct answer is not evidence of mastery", () => {
    const answers = [
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5"].map((q) => ans(q, true, day(1))),
      ans("q6", true, day(1), true),
    ];
    const r = masteryFor(answers, day(1));
    expect(r.distinctCorrect).toBe(5);
    expect(r.state).not.toBe("MASTERED");
  });

  it("a too-fast wrong answer still counts against accuracy", () => {
    const answers = [
      ...["w1", "w2", "w3"].map((q, i) => ans(q, false, day(0, 8 + i), true)),
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5", "q6"].map((q) => ans(q, true, day(1))),
    ];
    // 9 answers, 6 right = 67%: below the 80% bar, and mastery was never reached before.
    const r = masteryFor(answers, day(1));
    expect(r.accuracyPercent).toBe(67);
    expect(r.state).toBe("NEARLY_THERE");
  });

  it("stays mastered through a small dip but needs refresh after a bad slide", () => {
    const base = [
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5", "q6"].map((q) => ans(q, true, day(1))),
    ];
    // One wrong => 6/7 = 86% still fine
    expect(masteryFor([...base, ans("q7", false, day(1, 12))], day(1)).state).toBe("MASTERED");
    // Three wrong => 6/9 = 67%: below 80 but above 60, still MASTERED (hysteresis)
    const dip = [...base, ...["q7", "q8", "q9"].map((q, i) => ans(q, false, day(1, 12 + i)))];
    expect(masteryFor(dip, day(1)).state).toBe("MASTERED");
    // Five wrong => 6/11 -> window 10: 5/10 = 50%: below 60 => needs refresh
    const slide = [...base, ...["q7", "q8", "q9", "q10", "q11"].map((q, i) => ans(q, false, day(1, 12 + i)))];
    expect(masteryFor(slide, day(1)).state).toBe("NEEDS_REFRESH");
  });

  it("needs refresh after 30 days without practice", () => {
    const base = [
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5", "q6"].map((q) => ans(q, true, day(1))),
    ];
    expect(masteryFor(base, day(30)).state).toBe("MASTERED");
    expect(masteryFor(base, day(32)).state).toBe("NEEDS_REFRESH");
  });

  it("recovers from needs refresh by answering well again", () => {
    const base = [
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5", "q6"].map((q) => ans(q, true, day(1))),
    ];
    const again = [...base, ans("q7", true, day(40))];
    expect(masteryFor(again, day(40)).state).toBe("MASTERED");
  });

  it("is independent of input order", () => {
    const answers = [
      ...["q1", "q2", "q3"].map((q) => ans(q, true, day(0))),
      ...["q4", "q5", "q6"].map((q) => ans(q, true, day(1))),
    ];
    expect(masteryFor([...answers].reverse(), day(1)).state).toBe("MASTERED");
  });

  it("thresholds are tunable through the config", () => {
    const cfg = { ...QUEST_DEFAULTS, mastery: { ...QUEST_DEFAULTS.mastery, distinctCorrect: 2, minDays: 1 } };
    expect(masteryFor([ans("q1", true, day(0)), ans("q2", true, day(0))], day(0), cfg).state).toBe("MASTERED");
  });
});

describe("xpForAnswer", () => {
  const all = new Set<RewardKind>(ALL_REWARDS);
  const ctx = (over: Partial<XpAnswerContext> = {}): XpAnswerContext => ({
    correct: true,
    tooFast: false,
    hintUsed: false,
    wrongEarlierToday: false,
    missedOnEarlierDay: false,
    missedBonusPaid: false,
    alreadyEarnedToday: false,
    answerXpToday: 0,
    enabled: all,
    ...over,
  });

  it("pays 10 for a clean correct answer", () => {
    expect(xpForAnswer(ctx()).answerPoints).toBe(10);
  });
  it("pays 5 with a hint and 5 on a same-day retry", () => {
    expect(xpForAnswer(ctx({ hintUsed: true })).answerPoints).toBe(5);
    expect(xpForAnswer(ctx({ wrongEarlierToday: true })).answerPoints).toBe(5);
  });
  it("pays nothing for wrong or too-fast answers", () => {
    expect(xpForAnswer(ctx({ correct: false })).answerPoints).toBe(0);
    expect(xpForAnswer(ctx({ tooFast: true })).answerPoints).toBe(0);
  });
  it("pays a question once per day", () => {
    expect(xpForAnswer(ctx({ alreadyEarnedToday: true })).answerPoints).toBe(0);
  });
  it("adds the missed-before bonus once, for a miss on an earlier day", () => {
    expect(xpForAnswer(ctx({ missedOnEarlierDay: true }))).toMatchObject({ answerPoints: 10, missedBonusPoints: 5 });
    expect(xpForAnswer(ctx({ missedOnEarlierDay: true, missedBonusPaid: true })).missedBonusPoints).toBe(0);
  });
  it("stops at the daily cap", () => {
    expect(xpForAnswer(ctx({ answerXpToday: 95 }))).toMatchObject({ answerPoints: 5, cappedByDailyLimit: true });
    expect(xpForAnswer(ctx({ answerXpToday: 100 }))).toMatchObject({ answerPoints: 0, cappedByDailyLimit: true });
  });
  it("trims the bonus after the answer XP when capped", () => {
    expect(xpForAnswer(ctx({ answerXpToday: 92, missedOnEarlierDay: true }))).toMatchObject({
      answerPoints: 8,
      missedBonusPoints: 0,
    });
  });
  it("respects the instructor's reward switches", () => {
    expect(xpForAnswer(ctx({ enabled: new Set<RewardKind>() })).answerPoints).toBe(0);
    expect(xpForAnswer(ctx({ enabled: new Set<RewardKind>(["ANSWER"]), missedOnEarlierDay: true })).missedBonusPoints).toBe(0);
  });
  it("streak XP starts on the second day and respects its switch", () => {
    expect(streakXp(1, new Set(ALL_REWARDS))).toBe(0);
    expect(streakXp(2, new Set(ALL_REWARDS))).toBe(10);
    expect(streakXp(5, new Set<RewardKind>(["ANSWER"]))).toBe(0);
  });
});

describe("levelFor", () => {
  it("is Explorer until half the objectives are mastered", () => {
    expect(levelFor(1, 4)).toMatchObject({ level: "EXPLORER", neededForNext: 1 });
    expect(levelFor(2, 4)).toMatchObject({ level: "PROBLEM_SOLVER", neededForNext: 0 });
  });
  it("never reaches Problem Solver with no objectives", () => {
    expect(levelFor(0, 0).level).toBe("EXPLORER");
  });
});

describe("poolCoverage and suggestSplit", () => {
  it("reports shortages per objective", () => {
    const qs = [
      ...Array.from({ length: 10 }, () => ({ objectiveId: "o1", pool: "PRACTICE" as const })),
      ...Array.from({ length: 6 }, () => ({ objectiveId: "o1", pool: "FORMAL" as const })),
      ...Array.from({ length: 4 }, () => ({ objectiveId: "o2", pool: "PRACTICE" as const })),
      { objectiveId: "o2", pool: null },
    ];
    const r = poolCoverage(["o1", "o2"], qs);
    expect(r.objectives[0].ok).toBe(true);
    expect(r.objectives[1]).toMatchObject({ practiceShort: 6, formalShort: 6, untagged: 1, ok: false });
    expect(r.ready).toBe(false);
    expect(poolCoverage(["o1"], qs).ready).toBe(true);
  });
  it("is not ready with no objectives", () => {
    expect(poolCoverage([], []).ready).toBe(false);
  });
  it("splits 16 untagged questions into 6 formal and 10 practice", () => {
    const ids = Array.from({ length: 16 }, (_, i) => `q${i}`);
    const s = suggestSplit(ids, 0, 0);
    expect(s.formal).toHaveLength(6);
    expect(s.practice).toHaveLength(10);
  });
  it("respects existing tags", () => {
    const s = suggestSplit(["a", "b", "c", "d"], 5, 4);
    expect(s.formal.length + s.practice.length).toBe(4);
    expect(s.formal).toHaveLength(2);
  });
});

describe("pickQuestion and pickObjective", () => {
  const cands = [
    { id: "a", objectiveId: "o" },
    { id: "b", objectiveId: "o" },
    { id: "c", objectiveId: "o" },
  ];
  const first = () => 0;
  it("prefers unseen questions, then wrong ones, then the oldest", () => {
    const h = new Map([
      ["a", { answered: 1, lastWrong: false, lastAnsweredAt: new Date(5) }],
      ["b", { answered: 1, lastWrong: true, lastAnsweredAt: new Date(9) }],
    ]);
    expect(pickQuestion(cands, h, null, first)?.id).toBe("c");
    h.set("c", { answered: 1, lastWrong: false, lastAnsweredAt: new Date(7) });
    expect(pickQuestion(cands, h, null, first)?.id).toBe("b");
    h.set("b", { answered: 2, lastWrong: false, lastAnsweredAt: new Date(10) });
    expect(pickQuestion(cands, h, null, first)?.id).toBe("a");
  });
  it("does not repeat the question just served unless it is the only one", () => {
    expect(pickQuestion(cands, new Map(), "a", first)?.id).toBe("b");
    expect(pickQuestion([cands[0]], new Map(), "a", first)?.id).toBe("a");
    expect(pickQuestion([], new Map(), null)).toBeNull();
  });
  it("practises the weakest objective that has questions", () => {
    expect(
      pickObjective([
        { objectiveId: "x", progress: 0.9, hasQuestions: true },
        { objectiveId: "y", progress: 0.2, hasQuestions: true },
        { objectiveId: "z", progress: 0, hasQuestions: false },
      ])
    ).toBe("y");
    expect(pickObjective([{ objectiveId: "z", progress: 0, hasQuestions: false }])).toBeNull();
  });
});

describe("formal pool split and draw", () => {
  const identity = <U,>(items: U[]) => items;
  it("excludes practice questions from the formal assessment, keeps untagged legacy ones", () => {
    expect(isFormalEligible("PRACTICE")).toBe(false);
    expect(isFormalEligible("FORMAL")).toBe(true);
    expect(isFormalEligible(null)).toBe(true);
  });

  const pool = [
    ...["a1", "a2", "a3", "a4"].map((id) => ({ id, objectiveId: "A" })),
    ...["b1", "b2", "b3", "b4"].map((id) => ({ id, objectiveId: "B" })),
    ...["c1", "c2", "c3", "c4"].map((id) => ({ id, objectiveId: "C" })),
  ];
  const draw = (numQuestions: number | null, objectiveIds = ["A", "B", "C"]) => drawFormal(pool, { numQuestions, objectiveIds, shuffle: identity, randomize: false, objectiveOf: (q) => q.objectiveId });
  it("uses the whole pool when numQuestions is not set", () => {
    expect(draw(null)).toHaveLength(12);
  });
  it("tests every objective: each gets a question before any gets a second", () => {
    const drawn = draw(3);
    expect(drawn.map((q) => q.objectiveId).sort()).toEqual(["A", "B", "C"]);
    const six = draw(6);
    for (const id of ["A", "B", "C"]) expect(six.filter((q) => q.objectiveId === id)).toHaveLength(2);
  });
  it("spreads a larger draw evenly and never exceeds numQuestions or repeats a question", () => {
    const drawn = draw(8);
    expect(drawn).toHaveLength(8);
    expect(new Set(drawn.map((q) => q.id)).size).toBe(8);
    const counts = ["A", "B", "C"].map((id) => drawn.filter((q) => q.objectiveId === id).length).sort();
    expect(counts).toEqual([2, 3, 3]);
  });
  it("copes with an objective that has few or no questions by giving its share to the others", () => {
    const uneven = [{ id: "a1", objectiveId: "A" }, ...["b1", "b2", "b3", "b4"].map((id) => ({ id, objectiveId: "B" }))];
    const drawn = drawFormal(uneven, { numQuestions: 4, objectiveIds: ["A", "B", "C"], shuffle: identity, randomize: false, objectiveOf: (q) => q.objectiveId });
    expect(drawn).toHaveLength(4);
    expect(drawn.some((q) => q.objectiveId === "A")).toBe(true);
  });
  it("fills with questions that belong to no objective, and works with no objectives at all", () => {
    const mixed = [{ id: "x1", objectiveId: "" }, { id: "a1", objectiveId: "A" }, { id: "x2", objectiveId: "" }];
    const drawn = drawFormal(mixed, { numQuestions: 2, objectiveIds: ["A"], shuffle: identity, randomize: false, objectiveOf: (q) => q.objectiveId || null });
    expect(drawn.map((q) => q.id).sort()).toEqual(["a1", "x1"]);
    expect(draw(5, [])).toHaveLength(5);
  });
});
