import { describe, expect, it } from "vitest";
import { ARENA_DEFAULTS, RULE_KEYS, RULE_LIMITS, SWITCH_KEYS, availability, bonusPoints, normalizeSwitches, resolveArena, sanitizeArenaPatch } from "@/lib/arena/configCore";

describe("arena settings", () => {
  it("starts switched off, with the agreed rules", () => {
    const s = resolveArena([]);
    expect(s.enabled).toBe(false);
    expect(s.spectators).toBe("OFF");
    expect(s.questionSeconds).toBe(60);
    expect(s.pickSeconds).toBe(180);
    expect(s.bonusPercent).toBe(50);
    expect(availability(s)).toEqual({ arena: false, game: false, chat: false, ladder: false, fastest: false, wallet: false, events: false, spectators: "OFF" });
  });

  it("the narrowest scope that sets a value wins, and null falls back to the wider one", () => {
    const platform = { enabled: true, questionSeconds: 20, bonusPercent: 50 };
    const org = { questionSeconds: 12, bonusPercent: null };
    const course = { questionSeconds: null, pickSeconds: 8 };
    const s = resolveArena([platform, org, course]);
    expect(s.enabled).toBe(true);
    expect(s.questionSeconds).toBe(12);
    expect(s.bonusPercent).toBe(50);
    expect(s.pickSeconds).toBe(8);
  });

  it("a course can switch the arena off even when the platform has it on", () => {
    expect(resolveArena([{ enabled: true }, null, { enabled: false }]).enabled).toBe(false);
  });

  it("each feature needs the master switch, and spectators and the ladder need the game", () => {
    const on = { ...ARENA_DEFAULTS, enabled: true, chatEnabled: true, ladderEnabled: true, spectators: "ENROLLED" as const };
    expect(availability(on)).toEqual({ arena: true, game: true, chat: true, ladder: true, fastest: false, wallet: false, events: false, spectators: "ENROLLED" });
    expect(availability({ ...on, gameEnabled: false })).toMatchObject({ game: false, ladder: false, spectators: "OFF", chat: true });
    expect(availability({ ...on, enabled: false })).toEqual({ arena: false, game: false, chat: false, ladder: false, fastest: false, wallet: false, events: false, spectators: "OFF" });
  });

  it("Fastest Fingers is off by default and needs the chat", () => {
    expect(ARENA_DEFAULTS.fastestEnabled).toBe(false);
    const on = { ...ARENA_DEFAULTS, enabled: true, chatEnabled: true, fastestEnabled: true };
    expect(availability(on).fastest).toBe(true);
    expect(availability({ ...on, chatEnabled: false }).fastest).toBe(false);
    expect(normalizeSwitches({ ...on, chatEnabled: false }).fastestEnabled).toBe(false);
  });

  it("the credit wallet is off by default and needs the arena", () => {
    expect(ARENA_DEFAULTS.walletEnabled).toBe(false);
    const on = { ...ARENA_DEFAULTS, enabled: true, walletEnabled: true };
    expect(availability(on).wallet).toBe(true);
    expect(availability({ ...on, enabled: false }).wallet).toBe(false);
    expect(normalizeSwitches({ ...on, enabled: false }).walletEnabled).toBe(false);
  });

  it("live events are off by default and need the game", () => {
    expect(ARENA_DEFAULTS.eventsEnabled).toBe(false);
    const on = { ...ARENA_DEFAULTS, enabled: true, eventsEnabled: true };
    expect(availability(on).events).toBe(true);
    expect(availability({ ...on, gameEnabled: false }).events).toBe(false);
    expect(normalizeSwitches({ ...on, gameEnabled: false }).eventsEnabled).toBe(false);
  });

  it("normalizeSwitches turns dependants off", () => {
    const n = normalizeSwitches({ ...ARENA_DEFAULTS, enabled: false, chatEnabled: true, ladderEnabled: true, spectators: "LIVE" });
    expect(n).toMatchObject({ gameEnabled: false, chatEnabled: false, ladderEnabled: false, spectators: "OFF" });
  });
});

describe("cleaning a change from the browser", () => {
  it("clamps numbers into their limits so a typo cannot make a 0-second question", () => {
    const p = sanitizeArenaPatch({ questionSeconds: 0, pickSeconds: 9999, bonusPercent: -5, pausesPerPlayer: 2.6 }, RULE_KEYS);
    expect(p).toEqual({ questionSeconds: RULE_LIMITS.questionSeconds.min, pickSeconds: RULE_LIMITS.pickSeconds.max, bonusPercent: 0, pausesPerPlayer: 3 });
  });

  it("accepts numbers sent as text and ignores nonsense", () => {
    expect(sanitizeArenaPatch({ questionSeconds: "20", pickSeconds: "abc" }, RULE_KEYS)).toEqual({ questionSeconds: 20 });
  });

  it("only lets through the keys allowed for the caller", () => {
    const p = sanitizeArenaPatch({ enabled: true, questionSeconds: 30, spectators: "LIVE" }, RULE_KEYS);
    expect(p).toEqual({ questionSeconds: 30 });
    const all = sanitizeArenaPatch({ enabled: true, spectators: "LIVE", spectatorCap: 10_000 }, [...SWITCH_KEYS, ...RULE_KEYS]);
    expect(all).toEqual({ enabled: true, spectators: "LIVE", spectatorCap: 500 });
  });

  it("null goes back to the wider setting, and a bad spectator mode is dropped", () => {
    expect(sanitizeArenaPatch({ questionSeconds: null, spectators: "EVERYONE" }, [...SWITCH_KEYS, ...RULE_KEYS])).toEqual({ questionSeconds: null });
  });

  it("only real booleans switch things", () => {
    expect(sanitizeArenaPatch({ enabled: "yes", tickingSound: false }, [...SWITCH_KEYS, ...RULE_KEYS])).toEqual({ tickingSound: false });
  });
});

describe("bonus points", () => {
  it("adds the extra share to the normal points", () => {
    expect(bonusPoints(80, 50)).toBe(120);
    expect(bonusPoints(80, 25)).toBe(100);
    expect(bonusPoints(100, 0)).toBe(100);
    expect(bonusPoints(120, 50)).toBe(180);
  });
});
