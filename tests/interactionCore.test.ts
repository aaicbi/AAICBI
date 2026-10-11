import { describe, it, expect } from "vitest";
import { CommentSchema, ReportSchema, canRemoveComment, countLinks, decodeCursor, encodeCursor, mentionsIn, normalizeTag, parseTab, tokenize, COMMENT_MAX } from "@/lib/posts/interactionCore";

describe("comments", () => {
  it("needs text and respects the length", () => {
    expect(CommentSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(CommentSchema.safeParse({ body: "Nice work" }).success).toBe(true);
    expect(CommentSchema.safeParse({ body: "x".repeat(COMMENT_MAX + 1) }).success).toBe(false);
  });
  it("limits links to keep spam out", () => {
    expect(CommentSchema.safeParse({ body: "see https://a.example and https://b.example" }).success).toBe(true);
    expect(CommentSchema.safeParse({ body: "https://a.example https://b.example https://c.example" }).success).toBe(false);
    expect(countLinks("no links here, just text.")).toBe(0);
  });
  it("tidies whitespace", () => expect(CommentSchema.parse({ body: " Hi\r\n\r\n\r\n\r\nthere " }).body).toBe("Hi\n\nthere"));
  it("lets the author, the post's side and reviewers remove a comment, and nobody else", () => {
    expect(canRemoveComment({ isAuthor: true, isPostSide: false, isReviewer: false })).toBe(true);
    expect(canRemoveComment({ isAuthor: false, isPostSide: true, isReviewer: false })).toBe(true);
    expect(canRemoveComment({ isAuthor: false, isPostSide: false, isReviewer: true })).toBe(true);
    expect(canRemoveComment({ isAuthor: false, isPostSide: false, isReviewer: false })).toBe(false);
  });
});

describe("reports", () => {
  it("needs a known reason", () => {
    expect(ReportSchema.safeParse({ reason: "SPAM" }).success).toBe(true);
    expect(ReportSchema.safeParse({ reason: "BORING" }).success).toBe(false);
  });
  it("asks what is wrong when the reason is something else", () => {
    expect(ReportSchema.safeParse({ reason: "OTHER" }).success).toBe(false);
    expect(ReportSchema.safeParse({ reason: "OTHER", details: "It copies my work" }).success).toBe(true);
  });
});

describe("feed paging", () => {
  it("round-trips a cursor", () => {
    const d = new Date("2026-10-11T09:17:00.000Z");
    expect(decodeCursor(encodeCursor(d, "cmabc123"))).toEqual({ at: d, id: "cmabc123" });
  });
  it("refuses a damaged cursor", () => {
    for (const bad of [null, "", "nonsense", "2026-10-11|", "not-a-date|abc", "2026-10-11T09:17:00.000Z|bad id!", `2026-10-11T09:17:00.000Z|${"x".repeat(60)}`]) expect(decodeCursor(bad as string | null), String(bad)).toBeNull();
  });
  it("reads a tab safely", () => {
    expect(parseTab("following")).toBe("following");
    expect(parseTab("x")).toBe("latest");
  });
});

describe("turning text into links", () => {
  it("finds topics, mentions and web addresses, and keeps the rest as text", () => {
    const t = tokenize("Great #Python talk by @Amina-Bello, slides at https://example.com/a?b=1.");
    expect(t.map((x) => x.type)).toEqual(["text", "tag", "text", "mention", "text", "url", "text"]);
    expect(t[1]).toMatchObject({ value: "#Python", href: "/tags/python" });
    expect(t[3]).toMatchObject({ value: "@Amina-Bello", href: "/@amina-bello" });
    expect(t[5]).toMatchObject({ value: "https://example.com/a?b=1", href: "https://example.com/a?b=1" });
    expect(t.map((x) => x.value).join("")).toBe("Great #Python talk by @Amina-Bello, slides at https://example.com/a?b=1.");
  });
  it("never makes a link out of anything but http(s), and never touches markup", () => {
    const t = tokenize("<script>alert(1)</script> javascript:alert(1) ftp://x.example");
    expect(t.every((x) => x.type === "text")).toBe(true);
    expect(t.map((x) => x.value).join("")).toBe("<script>alert(1)</script> javascript:alert(1) ftp://x.example");
  });
  it("does not treat an email address or a mid-word # or @ as a mention or topic", () => {
    expect(tokenize("mail me at ada@example.com or a#b").every((x) => x.type === "text")).toBe(true);
  });
  it("lists mentions without repeats", () => expect(mentionsIn("@Ada hi @ada and @bola-ng")).toEqual(["ada", "bola-ng"]));
  it("normalises a topic from a URL", () => {
    expect(normalizeTag("%23Data")).toBe("data");
    expect(normalizeTag("a")).toBeNull();
    expect(normalizeTag("bad tag")).toBeNull();
  });
});
