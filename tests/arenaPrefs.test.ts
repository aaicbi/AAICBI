import { describe, it, expect } from "vitest";
import { isMuted, muteFor } from "@/lib/arena/prefsCore";

const now = Date.UTC(2026, 10, 18, 12);

describe("muting challenge alerts", () => {
  it("is not muted when nothing has been set", () => {
    expect(isMuted(null, now)).toBe(false);
    expect(isMuted({ challengeMuted: false, challengeMutedUntil: null }, now)).toBe(false);
  });
  it("mutes for an hour and lets go by itself afterwards", () => {
    const m = muteFor("1h", now);
    expect(isMuted(m, now + 59 * 60_000)).toBe(true);
    expect(isMuted(m, now + 61 * 60_000)).toBe(false);
  });
  it("mutes for eight hours", () => {
    const m = muteFor("8h", now);
    expect(isMuted(m, now + 7 * 3_600_000)).toBe(true);
    expect(isMuted(m, now + 9 * 3_600_000)).toBe(false);
  });
  it("mutes until turned back on, then turns back on", () => {
    expect(isMuted(muteFor("forever", now), now + 400 * 86_400_000)).toBe(true);
    expect(isMuted(muteFor("off", now), now)).toBe(false);
  });
});
