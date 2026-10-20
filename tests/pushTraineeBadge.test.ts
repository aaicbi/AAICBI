import { describe, it, expect, vi, beforeEach } from "vitest";

const sent: string[] = [];
const subs = [{ id: "s1", endpoint: "https://push.example/1", p256dh: "p".repeat(20), auth: "a".repeat(12) }];
const attentionOf = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { pushSubscription: { findMany: vi.fn(async () => subs), update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) } } }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async (_s: unknown, payload: string) => { sent.push(payload); }) } }));
vi.mock("@/lib/arena/attention", () => ({ attentionOf: (id: string) => attentionOf(id) }));

import { sendPushForNotification } from "@/lib/push/send";

beforeEach(() => {
  sent.length = 0;
  attentionOf.mockReset();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

describe("the number on the app icon for a trainee", () => {
  it("is the full count waiting for them on a challenge push, not left out", async () => {
    attentionOf.mockResolvedValue({ total: 4 });
    await sendPushForNotification("TRAINEE", "t1", { type: "ARENA_CHALLENGE", title: "Ada challenged you", body: "Accept?", url: "/trainee/arena/match/m1" });
    expect(attentionOf).toHaveBeenCalledWith("t1");
    expect(JSON.parse(sent[0]).badge).toBe(4);
    expect(JSON.parse(sent[0]).urgent).toBe(true);
  });
  it("replaces a smaller number a sender gave (one chat's unread) with the full count", async () => {
    attentionOf.mockResolvedValue({ total: 7 });
    await sendPushForNotification("TRAINEE", "t1", { type: "ARENA_TALK_c1", title: "t", body: "b", badge: 2 });
    expect(JSON.parse(sent[0]).badge).toBe(7);
  });
  it("is 0 when nothing is waiting, which clears the icon", async () => {
    attentionOf.mockResolvedValue({ total: 0 });
    await sendPushForNotification("TRAINEE", "t1", { type: "WALLET", title: "t", body: "b" });
    expect(JSON.parse(sent[0]).badge).toBe(0);
  });
  it("still sends, with the sender's number, if counting fails", async () => {
    attentionOf.mockRejectedValue(new Error("db down"));
    await sendPushForNotification("TRAINEE", "t1", { type: "X", title: "t", body: "b", badge: 3 });
    expect(JSON.parse(sent[0]).badge).toBe(3);
  });
  it("is not counted for people who are not trainees", async () => {
    await sendPushForNotification("TRAINING_ORG", "o1", { type: "X", title: "t", body: "b" });
    expect(attentionOf).not.toHaveBeenCalled();
    expect("badge" in JSON.parse(sent[0])).toBe(false);
  });
});
