import { describe, it, expect } from "vitest";
import { categorizeReferrer, categorizeDevice, isLikelyBot } from "../src/lib/analytics/visitorCategorizationCore";

describe("categorizeReferrer", () => {
  it("returns 'campaign' whenever a utm_source is present, regardless of referrer", () => {
    expect(categorizeReferrer(null, "newsletter")).toBe("campaign");
    expect(categorizeReferrer("google.com", "newsletter")).toBe("campaign");
  });

  it("returns 'direct' for no referrer and no utm_source", () => {
    expect(categorizeReferrer(null, null)).toBe("direct");
    expect(categorizeReferrer("", null)).toBe("direct");
  });

  it("recognizes common search engines", () => {
    expect(categorizeReferrer("www.google.com", null)).toBe("search");
    expect(categorizeReferrer("bing.com", null)).toBe("search");
    expect(categorizeReferrer("duckduckgo.com", null)).toBe("search");
  });

  it("recognizes common social/messaging platforms, including WhatsApp and Telegram", () => {
    expect(categorizeReferrer("www.facebook.com", null)).toBe("social");
    expect(categorizeReferrer("m.facebook.com", null)).toBe("social");
    expect(categorizeReferrer("whatsapp.com", null)).toBe("social");
    expect(categorizeReferrer("t.me", null)).toBe("social");
    expect(categorizeReferrer("www.linkedin.com", null)).toBe("social");
  });

  it("falls back to 'referral' for any other external hostname", () => {
    expect(categorizeReferrer("some-partner-site.com", null)).toBe("referral");
  });

  it("is case-insensitive", () => {
    expect(categorizeReferrer("WWW.GOOGLE.COM", null)).toBe("search");
  });
});

describe("categorizeDevice", () => {
  it("classifies common mobile user agents as 'mobile'", () => {
    expect(categorizeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(categorizeDevice("Mozilla/5.0 (Linux; Android 13; SM-G991B) Mobile")).toBe("mobile");
  });

  it("classifies common tablet user agents as 'tablet'", () => {
    expect(categorizeDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(categorizeDevice("Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit")).toBe("tablet"); // Android tablet, no "Mobile" token
  });

  it("classifies desktop user agents as 'desktop'", () => {
    expect(categorizeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe("desktop");
    expect(categorizeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
  });

  it("is case-insensitive", () => {
    expect(categorizeDevice("MOZILLA/5.0 (IPHONE; CPU IPHONE OS 17_0)")).toBe("mobile");
  });
});

describe("isLikelyBot", () => {
  it("recognizes well-known search/social crawlers", () => {
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(true);
    expect(isLikelyBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
  });

  it("recognizes common scripting/automation clients", () => {
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("Wget/1.21.3")).toBe(true);
    expect(isLikelyBot("python-requests/2.31.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0")).toBe(true);
  });

  it("does not flag genuine desktop or mobile browsers", () => {
    expect(isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isLikelyBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
  });

  it("does not flag a missing/empty User-Agent as a bot — that's also what a privacy-conscious browser looks like", () => {
    expect(isLikelyBot(null)).toBe(false);
    expect(isLikelyBot(undefined)).toBe(false);
    expect(isLikelyBot("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isLikelyBot("MOZILLA/5.0 (COMPATIBLE; GOOGLEBOT/2.1)")).toBe(true);
  });
});
