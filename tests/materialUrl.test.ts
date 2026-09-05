import { describe, it, expect } from "vitest";
import { safeUrl, isYouTubeUrl, extractYouTubeId, isGoogleHostedUrl, isAllowedVideoUrl, extractGoogleDriveFileId, resolveDownloadUrl } from "@/lib/materialUrl";

/**
 * Tests for the M10 audit's security fix (finding #1) — this is the
 * validator that stops a javascript:/data: URL from being stored as a
 * material link and later executed in a trainee's browser session. This
 * exact vulnerability was confirmed by hand before the fix was written
 * (see the M10 audit); these tests exist so it can't silently come back
 * if this file is ever touched again without re-reading that history.
 */
describe("safeUrl", () => {
  it("rejects javascript: URLs", () => {
    expect(safeUrl.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(safeUrl.safeParse("data:text/html,<script>alert(1)</script>").success).toBe(false);
  });

  it("rejects other non-http(s) schemes", () => {
    expect(safeUrl.safeParse("ftp://example.com/file").success).toBe(false);
    expect(safeUrl.safeParse("file:///etc/passwd").success).toBe(false);
  });

  it("accepts ordinary https URLs", () => {
    expect(safeUrl.safeParse("https://example.com/notes.pdf").success).toBe(true);
  });

  it("accepts ordinary http URLs", () => {
    expect(safeUrl.safeParse("http://example.com/notes.pdf").success).toBe(true);
  });

  it("rejects strings that aren't URLs at all", () => {
    expect(safeUrl.safeParse("not a url").success).toBe(false);
  });
});

describe("isYouTubeUrl", () => {
  it("accepts the common YouTube host variants", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeUrl("https://youtube.com/watch?v=abc123")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isYouTubeUrl("https://m.youtube.com/watch?v=abc123")).toBe(true);
  });

  it("rejects non-YouTube hosts, including look-alikes", () => {
    expect(isYouTubeUrl("https://vimeo.com/12345")).toBe(false);
    expect(isYouTubeUrl("https://youtube.com.evil.com/watch?v=abc")).toBe(false);
    expect(isYouTubeUrl("https://notyoutube.com")).toBe(false);
  });

  it("returns false rather than throwing on a malformed URL", () => {
    expect(isYouTubeUrl("not a url")).toBe(false);
  });
});

describe("extractYouTubeId", () => {
  it("extracts the ID from a standard watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from a youtu.be short URL", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts the ID from an /embed/ URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a YouTube URL shape it doesn't recognise, rather than guessing", () => {
    expect(extractYouTubeId("https://www.youtube.com/playlist?list=abc")).toBeNull();
  });

  it("returns null for a non-YouTube URL", () => {
    expect(extractYouTubeId("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null rather than throwing on a malformed URL", () => {
    expect(extractYouTubeId("not a url")).toBeNull();
  });
});

/**
 * M40 — video no longer needs to be YouTube-exclusive, since a genuine
 * offline-download feature needs a source it can actually fetch raw
 * file bytes from server-side, which YouTube's own Terms of Service
 * don't allow for.
 */
describe("isGoogleHostedUrl", () => {
  it("accepts Google Drive links", () => {
    expect(isGoogleHostedUrl("https://drive.google.com/file/d/abc123/view")).toBe(true);
  });

  it("accepts Google Docs links", () => {
    expect(isGoogleHostedUrl("https://docs.google.com/document/d/abc123")).toBe(true);
  });

  it("rejects non-Google hosts, including look-alikes", () => {
    expect(isGoogleHostedUrl("https://vimeo.com/12345")).toBe(false);
    expect(isGoogleHostedUrl("https://drive.google.com.evil.com/file")).toBe(false);
    expect(isGoogleHostedUrl("https://notgoogle.com")).toBe(false);
  });

  it("returns false rather than throwing on a malformed URL", () => {
    expect(isGoogleHostedUrl("not a url")).toBe(false);
  });
});

describe("isAllowedVideoUrl", () => {
  it("accepts YouTube URLs", () => {
    expect(isAllowedVideoUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
  });

  it("accepts Google-hosted URLs", () => {
    expect(isAllowedVideoUrl("https://drive.google.com/file/d/abc123/view")).toBe(true);
  });

  it("rejects a host that's neither", () => {
    expect(isAllowedVideoUrl("https://vimeo.com/12345")).toBe(false);
  });
});

describe("extractGoogleDriveFileId", () => {
  it("extracts the ID from a standard Drive share URL", () => {
    expect(extractGoogleDriveFileId("https://drive.google.com/file/d/1IIIq6BgH2y9l4GdkVQ-ApTo7dZm4bzVW/view?usp=sharing")).toBe(
      "1IIIq6BgH2y9l4GdkVQ-ApTo7dZm4bzVW"
    );
  });

  it("extracts the ID from a Drive preview URL", () => {
    expect(extractGoogleDriveFileId("https://drive.google.com/file/d/abc123/preview")).toBe("abc123");
  });

  it("returns null for a docs.google.com URL — not a video source, correctly falls through to a plain link", () => {
    expect(extractGoogleDriveFileId("https://docs.google.com/document/d/abc123")).toBeNull();
  });

  it("returns null for a non-Google URL", () => {
    expect(extractGoogleDriveFileId("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null rather than throwing on a malformed URL", () => {
    expect(extractGoogleDriveFileId("not a url")).toBeNull();
  });
});

describe("resolveDownloadUrl", () => {
  it("converts a Drive view URL to the real raw-download URL, not the interactive viewer page", () => {
    expect(resolveDownloadUrl("https://drive.google.com/file/d/abc123/view?usp=sharing")).toBe(
      "https://drive.google.com/uc?export=download&id=abc123"
    );
  });

  it("converts a Drive preview URL the same way", () => {
    expect(resolveDownloadUrl("https://drive.google.com/file/d/abc123/preview")).toBe(
      "https://drive.google.com/uc?export=download&id=abc123"
    );
  });

  it("returns a non-Drive URL unchanged — a direct PDF/DOCX/PPTX link is already the right thing to fetch as-is", () => {
    expect(resolveDownloadUrl("https://example.com/notes.pdf")).toBe("https://example.com/notes.pdf");
  });

  it("returns a YouTube URL unchanged — no legitimate download URL exists for it, so this is correctly left to fail the content-type check downstream", () => {
    expect(resolveDownloadUrl("https://www.youtube.com/watch?v=abc123")).toBe("https://www.youtube.com/watch?v=abc123");
  });
});
