import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EMBED_ALLOW, embedSrc, posterUrl } from "@/lib/video/embed";

describe("course video embedding", () => {
  it("embeds YouTube on the privacy host, inline on iPhone, never linking out", () => {
    const src = embedSrc({ kind: "youtube", id: "dQw4w9WgXcQ" }, { autoplay: true });
    const u = new URL(src);
    expect(u.hostname).toBe("www.youtube-nocookie.com");
    expect(u.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(u.searchParams.get("playsinline")).toBe("1"); // no forced native player on iPhone
    expect(u.searchParams.get("fs")).toBe("1"); // the player's own fullscreen button
    expect(u.searchParams.get("modestbranding")).toBe("1");
    expect(u.searchParams.get("autoplay")).toBe("1");
    expect(embedSrc({ kind: "youtube", id: "x" })).toContain("autoplay=0");
  });
  it("embeds Drive with its preview player and escapes ids", () => {
    expect(embedSrc({ kind: "drive", id: "abc" })).toBe("https://drive.google.com/file/d/abc/preview");
    expect(embedSrc({ kind: "youtube", id: "a/b?c" })).not.toContain("a/b?c");
  });
  it("allows fullscreen and autoplay in the frame", () => {
    expect(EMBED_ALLOW).toMatch(/fullscreen/);
    expect(EMBED_ALLOW).toMatch(/autoplay/);
    expect(posterUrl({ kind: "youtube", id: "abc" })).toContain("/vi/abc/");
  });
  it("no course page links a video out to youtube.com", () => {
    for (const f of ["src/app/trainee/courses/[id]/page.tsx", "src/app/learn/[id]/page.tsx", "src/components/video/VideoPlayer.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/href=\{?[`"']https:\/\/(www\.)?youtube\.com/);
    }
  });
});

describe("course card text safety", () => {
  const card = readFileSync("src/components/courses/CourseCard.tsx", "utf8");
  it("clamps title and description and wraps unbroken strings", () => {
    expect(card).toMatch(/line-clamp-2[^"]*font-display/);
    expect(card).toContain("line-clamp-3");
    expect(card).toContain("[overflow-wrap:anywhere]");
  });
  it("keeps a 16:9 picture, lazy loading, a branded fallback and a bottom-pinned call to action", () => {
    expect(card).toContain("aspect-video");
    expect(card).toContain('loading="lazy"');
    expect(card).toContain("FallbackImage");
    expect(card).toContain("mt-auto");
  });
  it("is the card used by both course lists", () => {
    for (const f of ["src/app/trainee/courses/page.tsx", "src/app/courses/page.tsx"]) expect(readFileSync(f, "utf8")).toContain("CourseCard");
  });
});
