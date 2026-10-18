import { describe, it, expect } from "vitest";
import { challengeNotice, replyNotice } from "@/lib/arena/challengeNotifyCore";

const f = { matchId: "m1", courseId: "c1", courseTitle: "Intro to Cybersecurity", fromName: "Amaka Okafor", toName: "Tunde Bello", topic: null, rematch: false };

describe("challenge notifications", () => {
  it("tells the challenged player who asked, in which course, and opens the match", () => {
    const n = challengeNotice(f);
    expect(n.title).toBe("Amaka challenged you");
    expect(n.body).toContain("Intro to Cybersecurity");
    expect(n.url).toBe("/trainee/arena/match/m1");
  });
  it("names the topic and calls a rematch a rematch", () => {
    const n = challengeNotice({ ...f, topic: "Networking basics", rematch: true });
    expect(n.title).toBe("Amaka wants a rematch");
    expect(n.body).toContain("Networking basics");
  });
  it("tells the challenger how it went and where to go next", () => {
    expect(replyNotice(f, true)).toMatchObject({ title: "Tunde accepted your challenge", url: "/trainee/arena/match/m1" });
    expect(replyNotice(f, false)).toMatchObject({ title: "Tunde declined your challenge", url: "/trainee/arena/c1" });
  });
  it("only links to pages on this site", () => {
    for (const n of [challengeNotice(f), replyNotice(f, true), replyNotice(f, false)]) expect(n.url.startsWith("/") && !n.url.startsWith("//")).toBe(true);
  });
});

import { expiredNotice } from "@/lib/arena/challengeNotifyCore";
describe("expired challenge notice", () => {
  it("tells the challenger nobody answered and where to go next", () => {
    const n = expiredNotice({ matchId: "m1", courseId: "c1", courseTitle: "Intro to Cybersecurity", fromName: "Amaka Okafor", toName: "Tunde Bello", topic: null, rematch: false });
    expect(n.title).toBe("Tunde didn't answer your challenge");
    expect(n.body).toContain("Intro to Cybersecurity");
    expect(n.url).toBe("/trainee/arena/c1");
  });
});
