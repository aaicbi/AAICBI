import { describe, expect, it } from "vitest";
import {
  CreateEducationPostSchema,
  isPubliclyVisible,
  normalizeSkills,
  slugify,
  SLUG_PATTERN,
  statusAfterConsent,
  statusAfterModeration,
} from "@/lib/ecosystem/educationPostCore";
import { parseYouTubeUrl } from "@/lib/ecosystem/youtube";

describe("parseYouTubeUrl", () => {
  it("accepts the common YouTube shapes and normalizes them", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      const parsed = parseYouTubeUrl(url);
      expect(parsed?.id).toBe("dQw4w9WgXcQ");
      expect(parsed?.watchUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(parsed?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
      expect(parsed?.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    }
  });

  it("rejects other hosts, bad ids and dangerous schemes", () => {
    for (const url of [
      "https://evil.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ\"><script>",
      "https://www.youtube.com/",
      "not a url",
      "",
    ]) {
      expect(parseYouTubeUrl(url)).toBeNull();
    }
  });
});

describe("consent and moderation transitions", () => {
  it("publishes at once for a verified organization, otherwise queues for review", () => {
    expect(statusAfterConsent(true, true)).toBe("PUBLISHED");
    expect(statusAfterConsent(true, false)).toBe("PENDING_REVIEW");
    expect(statusAfterConsent(false, true)).toBe("DECLINED");
    expect(statusAfterConsent(false, false)).toBe("DECLINED");
  });

  it("only lets SUPER_ADMIN approve or reject a post that is in review", () => {
    expect(statusAfterModeration("PENDING_REVIEW", "approve")).toBe("PUBLISHED");
    expect(statusAfterModeration("PENDING_REVIEW", "reject")).toBe("REJECTED");
    for (const s of ["AWAITING_CONSENT", "DECLINED", "PUBLISHED", "REJECTED", "REMOVED"] as const) {
      expect(statusAfterModeration(s, "approve")).toBeNull();
      expect(statusAfterModeration(s, "reject")).toBeNull();
    }
  });

  it("lets a post be pulled from any state except already removed", () => {
    expect(statusAfterModeration("PUBLISHED", "remove")).toBe("REMOVED");
    expect(statusAfterModeration("PENDING_REVIEW", "remove")).toBe("REMOVED");
    expect(statusAfterModeration("REMOVED", "remove")).toBeNull();
  });

  it("makes only published posts public", () => {
    expect(isPubliclyVisible("PUBLISHED")).toBe(true);
    for (const s of ["AWAITING_CONSENT", "DECLINED", "PENDING_REVIEW", "REJECTED", "REMOVED"] as const) {
      expect(isPubliclyVisible(s)).toBe(false);
    }
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Futybills Tech Community")).toBe("futybills-tech-community");
    expect(slugify("  École d'Été — Lagos!! ")).toBe("ecole-d-ete-lagos");
    expect(slugify("!!!")).toBe("organization");
    expect(SLUG_PATTERN.test(slugify("A  B"))).toBe(true);
    expect(slugify("x".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe("normalizeSkills", () => {
  it("trims and de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(normalizeSkills([" Power BI ", "power bi", "", "SQL"])).toEqual(["Power BI", "SQL"]);
  });
});

describe("CreateEducationPostSchema", () => {
  it("requires a trainee, a title and a link, and caps skills", () => {
    expect(CreateEducationPostSchema.safeParse({ traineeId: "", title: "Hello", youtubeUrl: "x" }).success).toBe(false);
    expect(CreateEducationPostSchema.safeParse({ traineeId: "t", title: "Hi", youtubeUrl: "x" }).success).toBe(false);
    expect(CreateEducationPostSchema.safeParse({ traineeId: "t", title: "Hello", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }).success).toBe(true);
    expect(
      CreateEducationPostSchema.safeParse({ traineeId: "t", title: "Hello", youtubeUrl: "u", skills: Array(9).fill("a") }).success
    ).toBe(false);
  });
});
