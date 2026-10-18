import { describe, it, expect } from "vitest";
import { buildPushPayload } from "@/lib/push/core";

describe("push badge number", () => {
  it("carries the unread count for the app icon when given", () => {
    expect(buildPushPayload({ type: "ARENA_TALK_c1", title: "Tunde · Intro", body: "hi", url: "/trainee/arena/c1/chat", badge: 3 }).badge).toBe(3);
  });
  it("leaves it out when not given or not a sensible number", () => {
    expect("badge" in buildPushPayload({ type: "X", title: "t", body: "b" })).toBe(false);
    expect("badge" in buildPushPayload({ type: "X", title: "t", body: "b", badge: -1 })).toBe(false);
  });
  it("caps a huge count", () => {
    expect(buildPushPayload({ type: "X", title: "t", body: "b", badge: 100000 }).badge).toBe(999);
  });
});
