import { describe, expect, it } from "vitest";
import { ASSET_RULES, DEFAULT_CAPTIONS, MAX_CAPTIONS, TEXT_MAX, assetPrefix, checkAsset, checkCaption, embedSnippet, prettySize, renderCaption, shareLink } from "@/lib/growth/shareCore";

describe("default captions", () => {
  it("each has a name, text and the link placeholder, and they pass the same check as your own", () => {
    expect(DEFAULT_CAPTIONS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_CAPTIONS.length).toBeLessThanOrEqual(MAX_CAPTIONS);
    for (const c of DEFAULT_CAPTIONS) expect(checkCaption(c).ok).toBe(true);
    expect(new Set(DEFAULT_CAPTIONS.map((c) => c.id)).size).toBe(DEFAULT_CAPTIONS.length);
  });
});

describe("checkCaption", () => {
  it("trims the name and text and keeps line breaks", () => {
    expect(checkCaption({ label: "  My   caption ", text: "  Play now!\r\n{link}  " })).toEqual({ ok: true, label: "My caption", text: "Play now!\n{link}" });
  });
  it("needs a name, enough text, and the link placeholder", () => {
    expect(checkCaption({ label: "", text: "Play now {link}" }).ok).toBe(false);
    expect(checkCaption({ label: "x", text: "short" }).ok).toBe(false);
    const r = checkCaption({ label: "x", text: "Play this quiz now, it is free" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("{link}");
  });
  it("refuses a name or text that is too long, and non-text input", () => {
    expect(checkCaption({ label: "a".repeat(41), text: "Play now {link}" }).ok).toBe(false);
    expect(checkCaption({ label: "x", text: "{link} " + "a".repeat(TEXT_MAX) }).ok).toBe(false);
    expect(checkCaption({ label: 5, text: null }).ok).toBe(false);
  });
  it("strips control characters", () => {
    const r = checkCaption({ label: "x", text: "Play\u0000 now\u0007 {link}" });
    expect(r.ok && r.text).toBe("Play now {link}");
  });
});

describe("renderCaption and shareLink", () => {
  it("fills in every link and the course name", () => {
    expect(renderCaption("{course}: {link} and again {link}", { link: "https://a.b/play/x?src=y", course: "AI" })).toBe("AI: https://a.b/play/x?src=y and again https://a.b/play/x?src=y");
  });
  it("builds the funnel link with a cleaned source label", () => {
    expect(shareLink("https://aaicbi.app/", "ai-fundamentals", "Lagos WhatsApp Group!")).toBe("https://aaicbi.app/play/ai-fundamentals?src=lagos-whatsapp-group");
    expect(shareLink("https://aaicbi.app", "ai-fundamentals")).toBe("https://aaicbi.app/play/ai-fundamentals");
    expect(shareLink("https://aaicbi.app", "ai-fundamentals", "  !! ")).toBe("https://aaicbi.app/play/ai-fundamentals");
  });
});

describe("embedSnippet", () => {
  it("makes a clickable image and escapes anything that could break out of the attributes", () => {
    const h = embedSnippet({ link: 'https://a.b/play/x?src=y&z="1"', imageUrl: "https://a.b/i.gif", alt: 'Play "now" <b>' });
    expect(h.startsWith("<a href=")).toBe(true);
    expect(h).toContain("&amp;z=&quot;1&quot;");
    expect(h).toContain('alt="Play &quot;now&quot; &lt;b&gt;"');
    expect(h).not.toContain("<b>");
  });
});

describe("checkAsset", () => {
  const blob = "https://abc123.public.blob.vercel-storage.com/growth-share/video/clip-xyz.mp4";
  it("accepts a stored video and a stored PDF", () => {
    expect(checkAsset("video", { url: blob, name: "Clip.mp4", size: 5_000_000, contentType: "video/mp4" }).ok).toBe(true);
    expect(checkAsset("pdf", { url: blob.replace("video", "pdf").replace(".mp4", ".pdf"), name: "Flyer.pdf", size: 900_000, contentType: "application/pdf" }).ok).toBe(true);
  });
  it("only accepts files stored by this app, never a link elsewhere", () => {
    for (const url of ["https://evil.example/clip.mp4", "http://abc.public.blob.vercel-storage.com/x.mp4", "javascript:alert(1)", "", 5])
      expect(checkAsset("video", { url, name: "a", size: 10, contentType: "video/mp4" }).ok).toBe(false);
  });
  it("checks the type and the size for each kind", () => {
    expect(checkAsset("video", { url: blob, name: "a", size: 10, contentType: "application/pdf" }).ok).toBe(false);
    expect(checkAsset("pdf", { url: blob, name: "a", size: 10, contentType: "video/mp4" }).ok).toBe(false);
    expect(checkAsset("video", { url: blob, name: "a", size: ASSET_RULES.video.maxBytes + 1, contentType: "video/mp4" }).ok).toBe(false);
    expect(checkAsset("pdf", { url: blob, name: "a", size: 0, contentType: "application/pdf" }).ok).toBe(false);
    expect(checkAsset("video", { url: blob, name: "a", size: ASSET_RULES.video.maxBytes, contentType: "VIDEO/MP4" }).ok).toBe(true);
  });
  it("cleans the file name", () => {
    const r = checkAsset("pdf", { url: blob, name: "C:\\fake\\my <flyer>.pdf", size: 10, contentType: "application/pdf" });
    expect(r.ok && r.asset.name).toBe("my flyer.pdf");
  });
});

describe("paths and sizes", () => {
  it("keeps uploads in one folder per kind", () => {
    expect(assetPrefix("video")).toBe("growth-share/video/");
    expect(assetPrefix("pdf")).toBe("growth-share/pdf/");
  });
  it("shows sizes in plain words", () => {
    expect(prettySize(2_621_440)).toBe("2.5 MB");
    expect(prettySize(40_000)).toBe("39 KB");
    expect(prettySize(10)).toBe("1 KB");
  });
});
