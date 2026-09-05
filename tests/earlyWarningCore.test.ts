import { describe, it, expect } from "vitest";
import { daysSince, isInactive, shouldTriggerInactivityAlert, shouldTriggerFailedAttemptsAlert } from "../src/lib/earlyWarningCore";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-24T00:00:00Z");

describe("daysSince", () => {
  it("returns null for a never-logged-in trainee", () => {
    expect(daysSince(null, now)).toBeNull();
  });
  it("computes whole days elapsed", () => {
    expect(daysSince(new Date(now.getTime() - 7 * DAY), now)).toBe(7);
  });
});

describe("isInactive", () => {
  it("is false when the course has the feature disabled (null threshold)", () => {
    expect(isInactive(new Date(now.getTime() - 30 * DAY), null, now)).toBe(false);
  });
  it("is false for a trainee who has never logged in at all — deliberate scope line", () => {
    expect(isInactive(null, 7, now)).toBe(false);
  });
  it("is false when under the threshold", () => {
    expect(isInactive(new Date(now.getTime() - 3 * DAY), 7, now)).toBe(false);
  });
  it("is true at exactly the threshold", () => {
    expect(isInactive(new Date(now.getTime() - 7 * DAY), 7, now)).toBe(true);
  });
  it("is true well past the threshold", () => {
    expect(isInactive(new Date(now.getTime() - 30 * DAY), 7, now)).toBe(true);
  });
});

describe("shouldTriggerInactivityAlert", () => {
  it("never fires if the trainee isn't currently inactive", () => {
    expect(
      shouldTriggerInactivityAlert({ currentlyInactive: false, existingAlertTriggeredAt: null, lastLoginAt: null })
    ).toBe(false);
  });
  it("fires on the first genuine crossing, no prior alert", () => {
    expect(
      shouldTriggerInactivityAlert({ currentlyInactive: true, existingAlertTriggeredAt: null, lastLoginAt: null })
    ).toBe(true);
  });
  it("does NOT re-fire while still in the same inactive stretch (no login since the last alert)", () => {
    const alertedAt = new Date(now.getTime() - 10 * DAY);
    expect(
      shouldTriggerInactivityAlert({ currentlyInactive: true, existingAlertTriggeredAt: alertedAt, lastLoginAt: null })
    ).toBe(false);
  });
  it("does NOT re-fire if the trainee's last login predates the existing alert", () => {
    const alertedAt = new Date(now.getTime() - 5 * DAY);
    const oldLogin = new Date(now.getTime() - 20 * DAY);
    expect(
      shouldTriggerInactivityAlert({ currentlyInactive: true, existingAlertTriggeredAt: alertedAt, lastLoginAt: oldLogin })
    ).toBe(false);
  });
  it("DOES re-fire if the trainee logged in again after the last alert and has since gone quiet", () => {
    const alertedAt = new Date(now.getTime() - 20 * DAY);
    const cameBack = new Date(now.getTime() - 10 * DAY);
    expect(
      shouldTriggerInactivityAlert({ currentlyInactive: true, existingAlertTriggeredAt: alertedAt, lastLoginAt: cameBack })
    ).toBe(true);
  });
});

describe("shouldTriggerFailedAttemptsAlert", () => {
  it("never fires if not currently over the threshold", () => {
    expect(
      shouldTriggerFailedAttemptsAlert({ currentlyOverThreshold: false, existingAlertTriggeredAt: null, hasPassedSinceLastAlert: false })
    ).toBe(false);
  });
  it("fires on the first genuine crossing", () => {
    expect(
      shouldTriggerFailedAttemptsAlert({ currentlyOverThreshold: true, existingAlertTriggeredAt: null, hasPassedSinceLastAlert: false })
    ).toBe(true);
  });
  it("does NOT re-fire for additional failures alone, with no passing attempt in between", () => {
    expect(
      shouldTriggerFailedAttemptsAlert({ currentlyOverThreshold: true, existingAlertTriggeredAt: new Date(), hasPassedSinceLastAlert: false })
    ).toBe(false);
  });
  it("DOES re-fire if the trainee passed since the last alert and is now failing again", () => {
    expect(
      shouldTriggerFailedAttemptsAlert({ currentlyOverThreshold: true, existingAlertTriggeredAt: new Date(), hasPassedSinceLastAlert: true })
    ).toBe(true);
  });
});
