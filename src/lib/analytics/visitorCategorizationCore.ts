/**
 * Analytics System Phase 2 — pure, I/O-free categorization. Both
 * functions take an already-narrow input (a hostname, a User-Agent
 * string) and return a coarse bucket — the raw input is never what
 * gets stored (see VisitorEvent's own schema comment), only what these
 * functions return.
 */
export type ReferrerSource = "direct" | "search" | "social" | "referral" | "campaign";
export type DeviceCategory = "mobile" | "desktop" | "tablet";

const SEARCH_DOMAINS = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];
// WhatsApp/Telegram deliberately included alongside the more conventional
// social networks — a very common real-world traffic source for a
// Nigeria/Africa-focused platform sharing a course link in a group chat.
const SOCIAL_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "threads.net",
  "whatsapp.com",
  "wa.me",
  "t.me",
  "telegram.org",
];

export function categorizeReferrer(referrerHostname: string | null, utmSource: string | null): ReferrerSource {
  if (utmSource) return "campaign";
  if (!referrerHostname) return "direct";
  const host = referrerHostname.toLowerCase();
  if (SEARCH_DOMAINS.some((d) => host.includes(d))) return "search";
  if (SOCIAL_DOMAINS.some((d) => host.includes(d))) return "social";
  return "referral";
}

export function categorizeDevice(userAgent: string): DeviceCategory {
  const ua = userAgent.toLowerCase();
  const isTablet = /ipad|tablet|kindle|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua));
  if (isTablet) return "tablet";
  if (/mobi|iphone|ipod|android/.test(ua)) return "mobile";
  return "desktop";
}

// Analytics System Phase 5 — a known-pattern check only, not a security
// feature: the goal is keeping obvious crawlers/scripts out of
// "visitor" counts, not blocking anything. Deliberately does NOT treat
// a missing/empty User-Agent as bot-like — that's also what a privacy-
// focused browser or extension looks like, and flagging it would risk
// excluding real, legitimate visitors for being cautious.
const BOT_UA_PATTERNS = [
  /bot\b/i,
  /spider/i,
  /crawl/i,
  /slurp/i,
  /headless/i,
  /phantomjs/i,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /facebookexternalhit/i,
  /preview/i,
];

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERNS.some((p) => p.test(userAgent));
}
