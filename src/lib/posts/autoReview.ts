/**
 * The automatic reviewer for posts. No database, so it can be tested.
 *
 * It reads the words of a post and adds up warning signs. A post with few signs is published at once and the decision is
 * written to its history as "Auto-review", so a person can still take it down later. A post with enough signs goes to the
 * human review inbox with the reasons attached, so the reviewer knows what to look at. Nothing here ever rejects a post:
 * only people reject.
 *
 * Trusted authors (a track record, nothing taken down, nothing open against them) are held to a higher bar: they publish
 * instantly unless the post shows serious warning signs.
 *
 * Switch it off with POST_AUTO_REVIEW=off: then every post except a super admin's goes to a person, as before.
 */

export interface Signal {
  code: string;
  weight: number;
  note: string;
}

export interface ReviewVerdict {
  publish: boolean;
  score: number;
  signals: Signal[];
}

/** A post is held for a person at or above this score. Trusted authors have a higher bar. */
export const THRESHOLD = { member: 2, trusted: 5 } as const;

export function autoReviewEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.POST_AUTO_REVIEW ?? "on").toLowerCase() !== "off";
}

// Words and phrases are matched whole, case-insensitively. The lists are short on purpose: they catch the obvious, and
// everything else is left to the reports and to the people who review.
const ABUSE = ["fuck", "fucking", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt", "whore", "slut", "nigger", "faggot", "idiot", "stupid", "kill yourself"];
const SCAM = [
  "guaranteed returns", "guaranteed profit", "double your money", "triple your money", "send me money", "send money", "wire transfer", "western union",
  "bitcoin investment", "crypto giveaway", "forex signal", "forex signals", "click here to win", "you have won", "you won", "claim your prize",
  "work from home and earn", "earn daily", "make money fast", "get rich", "no experience needed earn", "advance fee", "inheritance fund", "binary options",
  "loan offer", "dm me for investment", "whatsapp me", "telegram me",
];
const ADULT = ["porn", "nude", "nudes", "sex video", "escort", "onlyfans"];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "cutt.ly", "rb.gy", "is.gd", "shorturl.at", "wa.me"];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(phrase)}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export function signalsFor(input: { title?: string | null; body: string; duplicateOfRecent?: boolean; hasMedia?: boolean }): Signal[] {
  const text = `${input.title ?? ""}\n${input.body}`.trim();
  const out: Signal[] = [];
  const add = (code: string, weight: number, note: string) => out.push({ code, weight, note });

  const abuse = ABUSE.filter((w) => hasPhrase(text, w));
  if (abuse.length) add("abuse", 5, "Contains abusive or offensive language.");
  const scam = SCAM.filter((w) => hasPhrase(text, w));
  if (scam.length) add("scam", 5, `Looks like a scam or get-rich offer ("${scam[0]}").`);
  const adult = ADULT.filter((w) => hasPhrase(text, w));
  if (adult.length) add("adult", 5, "May contain adult content.");

  const urls = text.match(/https?:\/\/[^\s)]+|www\.[^\s)]+/gi) ?? [];
  const outside = urls.filter((u) => !/(youtube\.com|youtu\.be)/i.test(u));
  if (outside.length >= 3) add("many_links", 3, `Has ${outside.length} links.`);
  else if (outside.length === 2) add("two_links", 1, "Has two links.");
  if (urls.some((u) => SHORTENERS.some((s) => u.toLowerCase().includes(s)))) add("shortened_link", 2, "Uses a shortened link that hides where it goes.");

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) add("email", 2, "Shares an email address.");
  if (/(\+?\d[\d\s().-]{8,}\d)/.test(text.replace(/https?:\/\/\S+/g, ""))) add("phone", 2, "Shares a phone number.");

  const letters = text.replace(/[^\p{L}]/gu, "");
  const upper = text.replace(/[^\p{Lu}]/gu, "");
  if (letters.length >= 30 && upper.length / letters.length > 0.7) add("shouting", 2, "Mostly capital letters.");
  if (/(.)\1{7,}/u.test(text)) add("repeated_characters", 1, "Repeats the same character many times.");
  if (/[!?]{5,}/.test(text)) add("punctuation", 1, "Many exclamation or question marks in a row.");

  const tags = text.match(/#[\p{L}\p{N}_]{2,}/gu) ?? [];
  if (tags.length > 8) add("hashtag_stuffing", 2, `Has ${tags.length} hashtags.`);
  const mentions = text.match(/(^|\s)@[\p{L}\p{N}_-]{2,}/gu) ?? [];
  if (mentions.length > 6) add("mention_stuffing", 2, `Mentions ${mentions.length} people.`);

  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  if (words.length >= 12) {
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    const top = Math.max(...freq.values());
    if (top / words.length > 0.35) add("repetition", 2, "Repeats the same word over and over.");
  }
  if (!input.hasMedia && words.length > 0 && words.length < 3) add("too_short", 1, "Very little text.");
  if (input.duplicateOfRecent) add("duplicate", 3, "Matches a recent post by the same author.");
  return out;
}

export function review(input: { title?: string | null; body: string; trusted: boolean; duplicateOfRecent?: boolean; hasMedia?: boolean }): ReviewVerdict {
  const signals = signalsFor(input);
  const score = signals.reduce((n, s) => n + s.weight, 0);
  const limit = input.trusted ? THRESHOLD.trusted : THRESHOLD.member;
  return { publish: score < limit, score, signals };
}

/** One line for the post's history. */
export function describeVerdict(v: ReviewVerdict, trusted: boolean): string {
  if (v.publish) return trusted ? "Published by Auto-review: trusted author, nothing of concern found." : v.signals.length ? `Published by Auto-review (small concerns: ${v.signals.map((s) => s.note).join(" ")})` : "Published by Auto-review: nothing of concern found.";
  return `Sent to a person for review by Auto-review: ${v.signals.map((s) => s.note).join(" ")}`;
}

/** Trusted: a record of published posts and nothing taken down or open against the author. */
export function isTrusted(history: { published: number; removed: number; openReports: number }): boolean {
  return history.published >= 3 && history.removed === 0 && history.openReports === 0;
}
