import { describe, expect, it } from "vitest";
import { BASE_POINTS, FORFEIT_AFTER, boardSize, cleanMessage, dueAction, firstPoints, reactionsOpen, stealPoints, winnerOf, type Snapshot } from "@/lib/arena/arenaCore";

const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ status: "ACTIVE", phase: "ANSWER", phaseEndsAt: 10_000, expiresAt: 1e12, roundNo: 1, rounds: 10, paused: false, pausedAt: null, pauseMs: 60_000, lastActivityAt: 0, ...o });

describe("points", () => {
  it("a correct first answer earns the normal points, plus up to 20% for speed", () => {
    expect(firstPoints(80, 0, 15_000)).toBe(80);
    expect(firstPoints(80, 15_000, 15_000)).toBe(96);
    expect(firstPoints(80, 7_500, 15_000)).toBe(88);
    expect(firstPoints(100, 99_999, 15_000)).toBe(120);
  });
  it("speed can never outweigh being right: the most it adds is a fifth", () => {
    for (const base of Object.values(BASE_POINTS)) expect(firstPoints(base, 1e9, 15_000)).toBeLessThanOrEqual(Math.round(base * 1.2));
  });
  it("a stolen question is worth the normal points plus the bonus share", () => {
    expect(stealPoints(80, 50)).toBe(120);
    expect(stealPoints(80, 25)).toBe(100);
    expect(stealPoints(120, 50)).toBe(180);
  });
});

describe("what falls due", () => {
  it("nothing before the deadline", () => expect(dueAction(snap(), 9_999)).toBeNull());
  it("each phase has its own timeout", () => {
    expect(dueAction(snap({ phase: "PICK" }), 10_000)).toEqual({ type: "AUTO_PICK" });
    expect(dueAction(snap({ phase: "ANSWER" }), 10_000)).toEqual({ type: "FIRST_TIMEOUT" });
    expect(dueAction(snap({ phase: "STEAL" }), 10_000)).toEqual({ type: "STEAL_TIMEOUT" });
    expect(dueAction(snap({ phase: "REVEAL" }), 10_000)).toEqual({ type: "NEXT" });
  });
  it("a paused match does not time out, and resumes by itself after the longest pause", () => {
    const paused = snap({ paused: true, phaseEndsAt: null, pausedAt: 5_000, lastActivityAt: 5_000 });
    expect(dueAction(paused, 64_999)).toBeNull();
    expect(dueAction(paused, 65_000)).toEqual({ type: "AUTO_RESUME" });
  });
  it("an invitation or lobby that nobody answers expires", () => {
    expect(dueAction(snap({ status: "PENDING", expiresAt: 100 }), 99)).toBeNull();
    expect(dueAction(snap({ status: "PENDING", expiresAt: 100 }), 100)).toEqual({ type: "EXPIRE" });
    expect(dueAction(snap({ status: "LOBBY", expiresAt: 100 }), 200)).toEqual({ type: "EXPIRE" });
  });
  it("an active match nobody touches for half an hour is closed", () => {
    expect(dueAction(snap({ phaseEndsAt: 1e12, lastActivityAt: 0 }), 31 * 60_000)).toEqual({ type: "ABANDON" });
  });
  it("finished matches never fall due", () => expect(dueAction(snap({ status: "COMPLETED" }), 1e12)).toBeNull());
});

describe("results and limits", () => {
  const m = { challengerId: "a", opponentId: "b", scoreChallenger: 0, scoreOpponent: 0 };
  it("the higher score wins and equal scores are a draw", () => {
    expect(winnerOf({ ...m, scoreChallenger: 5 })).toBe("a");
    expect(winnerOf({ ...m, scoreOpponent: 5 })).toBe("b");
    expect(winnerOf(m)).toBeNull();
  });
  it("the board always has enough numbers", () => {
    expect(boardSize(10)).toBe(20);
    expect(boardSize(20)).toBe(20);
  });
  it("three missed turns in a row forfeit", () => expect(FORFEIT_AFTER).toBe(3));
});

describe("reactions and messages", () => {
  it("reactions are closed while a question is being answered or stolen", () => {
    expect(reactionsOpen("ACTIVE", "ANSWER", false)).toBe(false);
    expect(reactionsOpen("ACTIVE", "STEAL", false)).toBe(false);
    expect(reactionsOpen("ACTIVE", "PICK", false)).toBe(true);
    expect(reactionsOpen("ACTIVE", "REVEAL", false)).toBe(true);
    expect(reactionsOpen("ACTIVE", "PICK", true)).toBe(false);
    expect(reactionsOpen("COMPLETED", null, false)).toBe(true);
    expect(reactionsOpen("PENDING", null, false)).toBe(false);
  });
  it("messages are trimmed, cleaned and limited", () => {
    expect(cleanMessage("  hello   there \n")).toBe("hello there");
    expect(cleanMessage("a".repeat(500))!.length).toBe(140);
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage(42)).toBeNull();
  });
});
