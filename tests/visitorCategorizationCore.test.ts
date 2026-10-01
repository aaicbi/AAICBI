import { describe, it, expect } from "vitest";
import { categorizeReferrer, categorizeDevice } from "../src/lib/analytics/visitorCategorizationCore";

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
