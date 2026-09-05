import { describe, it, expect } from "vitest";
import { nextAttemptAllowedAt } from "../src/lib/cooldownCore";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-08-27T00:00:00Z");

describe("nextAttemptAllowedAt", () => {
  it("allows immediately when no cooldown is configured", () => {
    expect(nextAttemptAllowedAt(null, new Date(now.getTime() - HOUR), null, now)).toBeNull();
  });

  it("allows immediately on a first attempt — nothing to cool down from", () => {
    expect(nextAttemptAllowedAt(72, null, null, now)).toBeNull();
  });

  it("blocks retry while still inside the cooldown window", () => {
    const lastAttempt = new Date(now.getTime() - 10 * HOUR); // 10 hours ago, cooldown is 72
    const result = nextAttemptAllowedAt(72, lastAttempt, null, now);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(lastAttempt.getTime() + 72 * HOUR);
  });

  it("allows retry once the cooldown window has genuinely passed", () => {
    const lastAttempt = new Date(now.getTime() - 73 * HOUR); // just past 72
    expect(nextAttemptAllowedAt(72, lastAttempt, null, now)).toBeNull();
  });

  it("allows retry at exactly the boundary", () => {
    const lastAttempt = new Date(now.getTime() - 72 * HOUR);
    expect(nextAttemptAllowedAt(72, lastAttempt, null, now)).toBeNull();
  });

  it("does NOT bypass cooldown for an override granted BEFORE the attempt — the real one-time-use test", () => {
    const overrideGrantedAt = new Date(now.getTime() - 20 * HOUR);
    const lastAttempt = new Date(now.getTime() - 10 * HOUR); // attempted again AFTER the override was granted
    const result = nextAttemptAllowedAt(72, lastAttempt, overrideGrantedAt, now);
    expect(result).not.toBeNull(); // the override was already "used" by that attempt — this new cooldown applies
  });

  it("DOES bypass cooldown for an override granted AFTER the attempt", () => {
    const lastAttempt = new Date(now.getTime() - 10 * HOUR);
    const overrideGrantedAt = new Date(now.getTime() - 5 * HOUR); // granted after the attempt that triggered this cooldown
    expect(nextAttemptAllowedAt(72, lastAttempt, overrideGrantedAt, now)).toBeNull();
  });
});
