import { describe, it, expect } from "vitest";
import { PostInputSchema, extractTags, isMaterialEdit, isPubliclyVisible, nextStatus, needsReview, statusAfterEdit, typeOf, canEdit, canSubmit, canWithdraw, LIMITS } from "@/lib/posts/postCore";

describe("post input", () => {
  it("needs something to publish", () => {
    expect(PostInputSchema.safeParse({}).success).toBe(false);
    expect(PostInputSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(PostInputSchema.safeParse({ body: "Hello" }).success).toBe(true);
    expect(PostInputSchema.safeParse({ images: [{ url: "https://x.example/a.jpg" }] }).success).toBe(true);
    expect(PostInputSchema.safeParse({ youtubeUrl: "https://youtu.be/abc" }).success).toBe(true);
  });
  it("limits length, image count and unsafe links", () => {
    expect(PostInputSchema.safeParse({ body: "x".repeat(LIMITS.body + 1) }).success).toBe(false);
    const seven = Array.from({ length: LIMITS.images + 1 }, (_, i) => ({ url: `https://x.example/${i}.jpg` }));
    expect(PostInputSchema.safeParse({ images: seven }).success).toBe(false);
    expect(PostInputSchema.safeParse({ images: [{ url: "javascript:alert(1)" }] }).success).toBe(false);
    expect(PostInputSchema.safeParse({ images: [{ url: "http://insecure.example/a.jpg" }] }).success).toBe(false);
  });
  it("is a video or images, not both", () => {
    expect(PostInputSchema.safeParse({ youtubeUrl: "https://youtu.be/abc", images: [{ url: "https://x.example/a.jpg" }] }).success).toBe(false);
  });
  it("tidies the text and picks the type", () => {
    const r = PostInputSchema.parse({ body: "  Hi\r\n\r\n\r\n\r\nthere  " });
    expect(r.body).toBe("Hi\n\nthere");
    expect(r.visibility).toBe("PUBLIC");
    expect(typeOf({ youtubeUrl: null, images: [] })).toBe("TEXT");
    expect(typeOf({ youtubeUrl: null, images: [{}] })).toBe("IMAGE");
    expect(typeOf({ youtubeUrl: "https://youtu.be/x", images: [] })).toBe("YOUTUBE");
  });
});

describe("topics", () => {
  it("finds hashtags, lowercased and without repeats", () => {
    expect(extractTags("Learning #Python and #python today, also (#AI) and #data_science")).toEqual(["python", "ai", "data_science"]);
  });
  it("ignores things that are not topics", () => {
    expect(extractTags("email me at a#b.com or call #1 or # alone #x")).toEqual(["1"].filter(() => false));
  });
  it("caps the number of topics", () => {
    expect(extractTags(Array.from({ length: 20 }, (_, i) => `#tag${i}`).join(" "))).toHaveLength(LIMITS.tags);
  });
});

describe("editing a published post", () => {
  const base = { title: "T", body: "Hello world", youtubeId: null, images: ["https://x/a.jpg"] };
  it("treats wording, pictures and video as material, but not spacing", () => {
    expect(isMaterialEdit(base, { ...base, body: "Hello   world" })).toBe(false);
    expect(isMaterialEdit(base, { ...base, body: "Hello there" })).toBe(true);
    expect(isMaterialEdit(base, { ...base, images: [] })).toBe(true);
    expect(isMaterialEdit(base, { ...base, youtubeId: "abc" })).toBe(true);
    expect(isMaterialEdit(base, { ...base, title: "New" })).toBe(true);
  });
  it("sends a material edit back for review, except for a super admin", () => {
    expect(statusAfterEdit("PUBLISHED", true, false)).toBe("PENDING_REVIEW");
    expect(statusAfterEdit("PUBLISHED", false, false)).toBe("PUBLISHED");
    expect(statusAfterEdit("PUBLISHED", true, true)).toBe("PUBLISHED");
    expect(statusAfterEdit("DRAFT", true, false)).toBe("DRAFT");
  });
  it("only some statuses may be edited, submitted or withdrawn", () => {
    expect(["DRAFT", "CHANGES_REQUESTED", "PUBLISHED"].every((s) => canEdit(s as never))).toBe(true);
    expect(["PENDING_REVIEW", "REJECTED", "SUSPENDED"].some((s) => canEdit(s as never))).toBe(false);
    expect(canSubmit("DRAFT") && canSubmit("CHANGES_REQUESTED") && !canSubmit("PUBLISHED")).toBe(true);
    expect(canWithdraw("PENDING_REVIEW") && !canWithdraw("DRAFT")).toBe(true);
  });
  it("everyone but a super admin needs review", () => {
    expect(needsReview({ isSuperAdmin: false })).toBe(true);
    expect(needsReview({ isSuperAdmin: true })).toBe(false);
  });
});

describe("a reviewer's decision", () => {
  it("follows the allowed transitions", () => {
    expect(nextStatus("PENDING_REVIEW", "approve", null)).toEqual({ ok: true, status: "PUBLISHED" });
    expect(nextStatus("DRAFT", "approve", null).ok).toBe(false);
    expect(nextStatus("SUSPENDED", "reinstate", null)).toEqual({ ok: true, status: "PUBLISHED" });
    expect(nextStatus("PUBLISHED", "suspend", "Reported for spam links.")).toEqual({ ok: true, status: "SUSPENDED" });
    expect(nextStatus("PUBLISHED", "approve", null).ok).toBe(false);
  });
  it("needs a reason for anything but approving or reinstating", () => {
    for (const a of ["request_changes", "reject"] as const) {
      const r = nextStatus("PENDING_REVIEW", a, "");
      expect(r.ok).toBe(false);
      expect(!r.ok && r.code).toBe("reason");
    }
    expect(nextStatus("PENDING_REVIEW", "request_changes", "Please remove the phone number.")).toEqual({ ok: true, status: "CHANGES_REQUESTED" });
    expect(nextStatus("PUBLISHED", "suspend", "abc").ok).toBe(false);
  });
});

describe("who may see a post", () => {
  const p = (o: Partial<{ status: string; orgBlockedAt: Date | null; visibility: string }> = {}) => ({ status: "PUBLISHED", orgBlockedAt: null, visibility: "PUBLIC", ...o });
  it("shows a published public post to everyone", () => {
    expect(isPubliclyVisible(p(), { signedIn: false })).toBe(true);
    expect(isPubliclyVisible(p(), { signedIn: true })).toBe(true);
  });
  it("never shows anything that is not published", () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SUSPENDED"]) {
      expect(isPubliclyVisible(p({ status }), { signedIn: true }), status).toBe(false);
      expect(isPubliclyVisible(p({ status }), { signedIn: false }), status).toBe(false);
    }
  });
  it("hides an organization-blocked post from everyone", () => {
    expect(isPubliclyVisible(p({ orgBlockedAt: new Date() }), { signedIn: true })).toBe(false);
  });
  it("keeps members-only posts for signed-in people", () => {
    expect(isPubliclyVisible(p({ visibility: "MEMBERS" }), { signedIn: false })).toBe(false);
    expect(isPubliclyVisible(p({ visibility: "MEMBERS" }), { signedIn: true })).toBe(true);
  });
});
