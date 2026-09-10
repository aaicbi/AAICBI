import { describe, it, expect } from "vitest";
import { buildFromHeader, describeBroadcastStatus } from "@/lib/messaging/broadcastCore";

describe("buildFromHeader", () => {
  it("returns the input unchanged when no senderLabel is given", () => {
    expect(buildFromHeader("AAICBI <noreply@aaicbi.africa>")).toBe("AAICBI <noreply@aaicbi.africa>");
  });

  it("substitutes the display name in front of a bracketed address", () => {
    expect(buildFromHeader("AAICBI <noreply@aaicbi.africa>", "Loop — Systems Manager")).toBe(
      "Loop — Systems Manager <noreply@aaicbi.africa>"
    );
  });

  it("wraps a bare email address with the display name", () => {
    expect(buildFromHeader("onboarding@resend.dev", "Loop — Systems Manager")).toBe(
      "Loop — Systems Manager <onboarding@resend.dev>"
    );
  });

  it("falls back to the input unchanged when it contains no email address", () => {
    expect(buildFromHeader("not an email at all", "Loop — Systems Manager")).toBe("not an email at all");
  });
});

describe("describeBroadcastStatus", () => {
  it("reports FAILED when nothing was actually delivered", () => {
    expect(describeBroadcastStatus(0, 0)).toBe("FAILED");
  });

  it("reports SENT when every attempted send succeeded", () => {
    expect(describeBroadcastStatus(10, 0)).toBe("SENT");
  });

  it("reports PARTIAL when some but not all attempted sends failed", () => {
    expect(describeBroadcastStatus(10, 3)).toBe("PARTIAL");
  });

  it("reports FAILED over PARTIAL when the actual count is zero even if failed is nonzero", () => {
    expect(describeBroadcastStatus(0, 5)).toBe("FAILED");
  });
});
