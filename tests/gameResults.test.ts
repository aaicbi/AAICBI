import { describe, expect, it } from "vitest";
import { mergePlayers, summarize, type PlayCount } from "@/lib/quest/resultsCore";
import { cleanPermissions, permissionsFrom, DEFAULT_STUDIO_PERMISSIONS } from "@/lib/quest/permissions";

const d = (s: string) => new Date(s);
const who = new Map([["t1", { name: "Ada", email: "ada@x.test", kind: "TRAINEE" }], ["e1", { name: "Bo (Acme)", email: "bo@x.test", kind: "EMPLOYER" }]]);
const rows: PlayCount[] = [
  { userId: "t1", gameId: "g1", format: "MATCHING", source: "COURSE", answers: 10, correct: 7, scoreSum: 8.5, first: d("2026-10-01"), last: d("2026-10-05") },
  { userId: "t1", gameId: null, format: "QUIZ", source: "COURSE", answers: 10, correct: 5, scoreSum: 5, first: d("2026-10-02"), last: d("2026-10-09") },
  { userId: "t1", gameId: "g2", format: "SCENARIO", source: "FEED", answers: 10, correct: 9, scoreSum: 9, first: d("2026-10-03"), last: d("2026-10-07") },
  { userId: "e1", gameId: "g2", format: "SCENARIO", source: "FEED", answers: 4, correct: 1, scoreSum: 1, first: d("2026-10-08"), last: d("2026-10-08") },
  { userId: "ghost", gameId: "g1", format: "ORDERING", source: "COURSE", answers: 0, correct: 0, scoreSum: 0, first: null, last: null },
];

describe("game results", () => {
  const players = mergePlayers(rows, who);
  it("makes one row per player across course games, quiz practice and the feed, leaving out players with no answers", () => {
    expect(players.map((p) => p.userId).sort()).toEqual(["e1", "t1"]);
    const t = players.find((p) => p.userId === "t1")!;
    expect(t.answers).toBe(30);
    expect(t.correct).toBe(21);
    expect(t.accuracy).toBe(70);
    expect(t.averageScore).toBe(75);
    expect(t.games).toBe(3);
    expect(t.sources).toEqual(["COURSE", "FEED"]);
    expect(t.byFormat.QUIZ).toEqual({ answers: 10, correct: 5 });
    expect(t.first?.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(t.last?.toISOString().slice(0, 10)).toBe("2026-10-09");
  });
  it("sorts by who played most recently and names people it cannot identify", () => {
    expect(players[0].userId).toBe("t1");
    const unknown = mergePlayers([{ ...rows[0], userId: "zz" }], new Map());
    expect(unknown[0].name).toBe("Unknown player");
  });
  it("summarises players, recent activity and accuracy", () => {
    const s = summarize(players, d("2026-10-10"));
    expect(s).toEqual({ players: 2, activeLast7Days: 2, answers: 34, accuracy: 65 });
    expect(summarize(players, d("2026-11-30")).activeLast7Days).toBe(0);
  });
});

describe("who may see game results", () => {
  it("is opt-in: staff do not get it by default, and a switch adds only that permission", () => {
    expect(DEFAULT_STUDIO_PERMISSIONS).not.toContain("GAME_RESULTS");
    expect(permissionsFrom(null)).not.toContain("GAME_RESULTS");
    const on = cleanPermissions([...permissionsFrom(null), "GAME_RESULTS"]);
    expect(on).toContain("GAME_RESULTS");
    expect(on).toContain("GAMES");
    expect(cleanPermissions(on.filter((k) => k !== "GAME_RESULTS"))).not.toContain("GAME_RESULTS");
  });
});
