import { describe, it, expect } from "vitest";
import { bracketSize, totalRoundsFor, seedOrder, firstRound, nextRound, roundName, noShowWinner } from "@/lib/arena/eventCore";

describe("knockout bracket", () => {
  it("rounds the bracket up to a power of two", () => {
    expect([2, 3, 4, 5, 8, 9, 16].map(bracketSize)).toEqual([2, 4, 4, 8, 8, 16, 16]);
    expect([2, 4, 8, 16].map(totalRoundsFor)).toEqual([1, 2, 3, 4]);
  });
  it("seeds so the strongest meet last", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("pairs eight players with seed 1 against seed 8", () => {
    const p = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
    const r = firstRound(p);
    expect(r.map((t) => [t.a, t.b])).toEqual([["s1", "s8"], ["s4", "s5"], ["s2", "s7"], ["s3", "s6"]]);
    expect(r.some((t) => t.bye)).toBe(false);
  });
  it("gives the top seeds the byes when the number is odd", () => {
    const r = firstRound(["s1", "s2", "s3", "s4", "s5"]);
    expect(r).toHaveLength(4);
    const byes = r.filter((t) => t.bye).map((t) => t.a ?? t.b);
    expect(byes.sort()).toEqual(["s1", "s2", "s3"]);
    expect(r.filter((t) => !t.bye)).toEqual([{ slot: 1, a: "s4", b: "s5", bye: false }]);
  });
  it("handles two and three players", () => {
    expect(firstRound(["a", "b"])).toEqual([{ slot: 0, a: "a", b: "b", bye: false }]);
    const three = firstRound(["a", "b", "c"]);
    expect(three.filter((t) => t.bye)).toHaveLength(1);
  });
  it("pairs neighbouring winners into the next round", () => {
    expect(nextRound(["a", "b", "c", "d"])).toEqual([{ slot: 0, a: "a", b: "b" }, { slot: 1, a: "c", b: "d" }]);
  });
  it("names the rounds", () => {
    expect([1, 2, 3].map((r) => roundName(r, 3))).toEqual(["Quarter-finals", "Semi-finals", "Final"]);
    expect(roundName(1, 4)).toBe("Round of 16");
  });
  it("a no-show loses; with nobody ready the better seed goes through", () => {
    expect(noShowWinner({ id: "a", seed: 4, ready: true }, { id: "b", seed: 1, ready: false })).toBe("a");
    expect(noShowWinner({ id: "a", seed: 4, ready: false }, { id: "b", seed: 1, ready: false })).toBe("b");
  });
});
