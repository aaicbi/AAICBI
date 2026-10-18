/** Ayakbi Arena personal settings, as pure functions: muting phone alerts for challenges. */
export type MuteChoice = "off" | "1h" | "8h" | "forever";
export interface MuteState { challengeMuted: boolean; challengeMutedUntil: Date | null }

export const MUTE_HOURS: Record<"1h" | "8h", number> = { "1h": 1, "8h": 8 };

export function isMuted(p: MuteState | null | undefined, now = Date.now()): boolean {
  if (!p) return false;
  return p.challengeMuted || (p.challengeMutedUntil !== null && p.challengeMutedUntil.getTime() > now);
}

/** What to store for a choice. `off` turns alerts back on. */
export function muteFor(choice: MuteChoice, now = Date.now()): MuteState {
  if (choice === "forever") return { challengeMuted: true, challengeMutedUntil: null };
  if (choice === "off") return { challengeMuted: false, challengeMutedUntil: null };
  return { challengeMuted: false, challengeMutedUntil: new Date(now + MUTE_HOURS[choice] * 3_600_000) };
}
