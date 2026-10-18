/**
 * Gaming Arena: the switches and rules, as pure functions (no database).
 *
 * A Super Admin turns features on or off for the whole platform, for one organization or for one course.
 * Instructors set the rules of play for their own course. Each scope is one row with every field optional:
 * a missing value means "use the wider scope", so the narrowest row that sets a value wins.
 */
export type ArenaSpectatorMode = "OFF" | "ENROLLED" | "LIVE";

export interface ArenaSwitches {
  /** The master switch. Nothing in the arena works while this is off. */
  enabled: boolean;
  gameEnabled: boolean;
  chatEnabled: boolean;
  ladderEnabled: boolean;
  spectators: ArenaSpectatorMode;
  /** Most spectators allowed to watch one match. */
  spectatorCap: number;
}

export interface ArenaRules {
  /** Seconds to answer a question. */
  questionSeconds: number;
  /** Safety net, not a visible timer: if a player never picks a number, the system picks one after this many seconds. */
  pickSeconds: number;
  /** Extra points, as a percentage of the question's normal points, for answering a question the other player missed. */
  bonusPercent: number;
  pausesPerPlayer: number;
  /** Longest a pause may last before the game resumes by itself. */
  pauseSeconds: number;
  questionsPerMatch: number;
  tickingSound: boolean;
}

export type ArenaSettings = ArenaSwitches & ArenaRules;
export type ArenaRow = { [K in keyof ArenaSettings]?: ArenaSettings[K] | null };

/** The seconds the other player gets to answer a missed question. Fixed by the game's design. */
export const STEAL_SECONDS = 20;

export const ARENA_DEFAULTS: ArenaSettings = {
  enabled: false,
  gameEnabled: true,
  chatEnabled: false,
  ladderEnabled: false,
  spectators: "OFF",
  spectatorCap: 50,
  questionSeconds: 60,
  pickSeconds: 180,
  bonusPercent: 50,
  pausesPerPlayer: 2,
  pauseSeconds: 60,
  questionsPerMatch: 20,
  tickingSound: true,
};

export const RULE_LIMITS = {
  questionSeconds: { min: 10, max: 180 },
  pickSeconds: { min: 30, max: 600 },
  bonusPercent: { min: 0, max: 200 },
  pausesPerPlayer: { min: 0, max: 3 },
  pauseSeconds: { min: 15, max: 300 },
  questionsPerMatch: { min: 4, max: 30 },
  spectatorCap: { min: 0, max: 500 },
} as const;

export const SWITCH_KEYS = ["enabled", "gameEnabled", "chatEnabled", "ladderEnabled", "spectators", "spectatorCap"] as const;
export const RULE_KEYS = ["questionSeconds", "pickSeconds", "bonusPercent", "pausesPerPlayer", "pauseSeconds", "questionsPerMatch", "tickingSound"] as const;

type NumKey = keyof typeof RULE_LIMITS;
const NUMERIC = Object.keys(RULE_LIMITS) as NumKey[];

const clampInt = (v: unknown, k: NumKey): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const { min, max } = RULE_LIMITS[k];
  return Math.min(max, Math.max(min, Math.round(n)));
};

/**
 * Cleans an update from the browser. Keys not allowed (`allowed`) or not understood are dropped; `null` means "go back to the wider scope".
 * Numbers are clamped into their limits so a typo can never produce a 0-second question.
 */
export function sanitizeArenaPatch(input: unknown, allowed: readonly (keyof ArenaSettings)[]): ArenaRow {
  const out: ArenaRow = {};
  const r = (input ?? {}) as Record<string, unknown>;
  for (const key of allowed) {
    if (!(key in r)) continue;
    const v = r[key];
    if (v === null) { (out as Record<string, unknown>)[key] = null; continue; }
    if ((NUMERIC as string[]).includes(key)) {
      const n = clampInt(v, key as NumKey);
      if (n !== null) (out as Record<string, unknown>)[key] = n;
    } else if (key === "spectators") {
      if (v === "OFF" || v === "ENROLLED" || v === "LIVE") out.spectators = v;
    } else if (typeof v === "boolean") {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

/** Rows from the widest scope to the narrowest (platform, organization, course). The narrowest value that is set wins. */
export function resolveArena(rows: (ArenaRow | null | undefined)[]): ArenaSettings {
  const out: ArenaSettings = { ...ARENA_DEFAULTS };
  for (const row of rows) {
    if (!row) continue;
    for (const key of Object.keys(ARENA_DEFAULTS) as (keyof ArenaSettings)[]) {
      const v = row[key];
      if (v !== null && v !== undefined) (out as unknown as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

export interface ArenaAvailable {
  /** The arena exists at all. */
  arena: boolean;
  game: boolean;
  chat: boolean;
  ladder: boolean;
  spectators: ArenaSpectatorMode;
}

/** What is actually usable: each feature needs the master switch, and spectators and the ladder need the game. */
export function availability(s: ArenaSettings): ArenaAvailable {
  const arena = s.enabled;
  const game = arena && s.gameEnabled;
  return { arena, game, chat: arena && s.chatEnabled, ladder: game && s.ladderEnabled, spectators: game ? s.spectators : "OFF" };
}

/** The same settings with every dependent switch forced into line (used when saving, so the stored row never contradicts itself). */
export function normalizeSwitches(s: ArenaSettings): ArenaSettings {
  const out = { ...s };
  if (!out.enabled) { out.gameEnabled = false; out.chatEnabled = false; out.ladderEnabled = false; out.spectators = "OFF"; }
  if (!out.gameEnabled) { out.ladderEnabled = false; out.spectators = "OFF"; }
  return out;
}

/** Points a question is worth when someone answers it after the other player missed it. */
export function bonusPoints(base: number, bonusPercent: number): number {
  return Math.round(base * (1 + bonusPercent / 100));
}

export const ARENA_SETTING_LABELS: Record<keyof ArenaSettings, string> = {
  enabled: "Gaming Arena",
  gameEnabled: "Two-player Interview game",
  chatEnabled: "Course chat",
  ladderEnabled: "Champion ladder",
  spectators: "Spectators",
  spectatorCap: "Most spectators per match",
  questionSeconds: "Seconds per question",
  pickSeconds: "Longest wait for a number pick (seconds)",
  bonusPercent: "Bonus for a stolen question",
  pausesPerPlayer: "Pauses per player",
  pauseSeconds: "Longest pause",
  questionsPerMatch: "Questions per match",
  tickingSound: "Ticking sound",
};
