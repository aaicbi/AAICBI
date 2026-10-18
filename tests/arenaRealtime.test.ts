import { describe, expect, it } from "vitest";
import { capabilityFor, channels } from "@/lib/arena/realtimeCore";

describe("arena real-time channels", () => {
  it("names every channel under the aaicbi:arena namespace the Ably key is restricted to", () => {
    for (const c of [channels.user("t1"), channels.course("c1"), channels.match("m1"), channels.watch("m1"), channels.ping()]) expect(c.startsWith("aaicbi:arena:")).toBe(true);
  });

  it("gives a trainee subscribe-only access to their own channel, their courses and their matches", () => {
    const cap = capabilityFor({ traineeId: "t1", courseIds: ["c1", "c2"], matchIds: ["m1"] });
    expect(Object.keys(cap).sort()).toEqual(["aaicbi:arena:course:c1", "aaicbi:arena:course:c2", "aaicbi:arena:match:m1", "aaicbi:arena:user:t1"]);
    for (const rights of Object.values(cap)) expect(rights).toEqual(["subscribe"]);
  });

  it("never lets a browser publish, and never includes another person's channel", () => {
    const cap = capabilityFor({ traineeId: "t1", courseIds: [], matchIds: [] });
    expect(JSON.stringify(cap)).not.toContain("publish");
    expect(Object.keys(cap)).toEqual(["aaicbi:arena:user:t1"]);
  });

  it("caps how many channels one token can reach", () => {
    const many = Array.from({ length: 200 }, (_, i) => `x${i}`);
    expect(Object.keys(capabilityFor({ traineeId: "t", courseIds: many, matchIds: many })).length).toBeLessThanOrEqual(1 + 50 + 20);
  });
});
