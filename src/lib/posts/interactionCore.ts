import { z } from "zod";

/**
 * Rules for taking part, with no database so they can be tested: reactions,
 * comments, reports, the feed's paging cursor, and how post text is turned
 * into safe links (topics, mentions, web addresses) without ever inserting
 * raw HTML.
 */
export const REACTIONS = ["LIKE", "INSIGHTFUL", "CELEBRATE", "DISLIKE"] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export const REACTION_LABEL: Record<ReactionKind, string> = { LIKE: "Like", INSIGHTFUL: "Insightful", CELEBRATE: "Celebrate", DISLIKE: "Dislike" };

export const COMMENT_MAX = 1000;
export const MAX_LINKS_IN_COMMENT = 2;
export const LIMITS_PER_HOUR = { comments: 20, reactions: 240, follows: 100, reports: 20, bookmarks: 200 } as const;

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/gi;
export const countLinks = (s: string) => (s.match(URL_RE) ?? []).length;

export const CommentSchema = z.object({
  body: z.string().max(COMMENT_MAX * 2).transform((v) => v.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()),
  parentId: z.string().min(1).max(40).optional(),
}).superRefine((v, ctx) => {
  if (v.body.length < 1) ctx.addIssue({ code: "custom", path: ["body"], message: "Write a comment first." });
  else if (v.body.length > COMMENT_MAX) ctx.addIssue({ code: "custom", path: ["body"], message: `Please keep a comment under ${COMMENT_MAX} characters.` });
  else if (countLinks(v.body) > MAX_LINKS_IN_COMMENT) ctx.addIssue({ code: "custom", path: ["body"], message: `A comment can have up to ${MAX_LINKS_IN_COMMENT} links.` });
});

/** Who may remove a comment: its author, the post's own side, or a reviewer. */
export function canRemoveComment(who: { isAuthor: boolean; isPostSide: boolean; isReviewer: boolean }): boolean {
  return who.isAuthor || who.isPostSide || who.isReviewer;
}

export const REPORT_REASONS = ["SPAM", "ABUSE", "MISLEADING", "PRIVACY", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_LABEL: Record<ReportReason, string> = { SPAM: "Spam or scam", ABUSE: "Abuse or harassment", MISLEADING: "Misleading or false", PRIVACY: "Shares private information", OTHER: "Something else" };

export const ReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional().transform((v) => v || null),
  commentId: z.string().min(1).max(40).optional(),
}).superRefine((v, ctx) => {
  if (v.reason === "OTHER" && !v.details) ctx.addIssue({ code: "custom", path: ["details"], message: "Tell us what is wrong." });
});

/** Paging through the feed: newest first, with the id as a tie-breaker so no post is skipped or repeated. */
export function encodeCursor(publishedAt: Date, id: string): string {
  return `${publishedAt.toISOString()}|${id}`;
}
export function decodeCursor(raw: string | null | undefined): { at: Date; id: string } | null {
  if (!raw) return null;
  const [iso, id] = raw.split("|");
  const at = new Date(iso);
  if (!id || Number.isNaN(at.getTime()) || id.length > 40 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return { at, id };
}

export type FeedTab = "latest" | "following" | "discover";
export const FEED_TABS: FeedTab[] = ["latest", "following", "discover"];
export function parseTab(raw: string | null | undefined): FeedTab {
  return (FEED_TABS as string[]).includes(raw ?? "") ? (raw as FeedTab) : "latest";
}

export type Token = { type: "text" | "tag" | "mention" | "url"; value: string; href?: string };

/**
 * Splits post text into plain text, #topics, @mentions and web addresses.
 * The page renders each token as text or as a link it builds itself, so the
 * text can never inject markup. Only http(s) addresses become links.
 */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(^|[\s(])#([\p{L}\p{N}_]{2,30})|(^|[\s(])@([a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const lead = m[1] ? "" : (m[2] ?? m[4] ?? "");
    const start = m.index + lead.length;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    if (m[1]) out.push({ type: "url", value: m[1], href: m[1] });
    else if (m[3]) out.push({ type: "tag", value: `#${m[3]}`, href: `/tags/${encodeURIComponent(m[3].toLowerCase())}` });
    else if (m[5]) out.push({ type: "mention", value: `@${m[5]}`, href: `/@${m[5].toLowerCase()}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** The @handles in a text, lowercased, without repeats. */
export function mentionsIn(text: string): string[] {
  return [...new Set(tokenize(text).filter((t) => t.type === "mention").map((t) => t.value.slice(1).toLowerCase()))].slice(0, 10);
}

/** A topic as typed in a URL or search box: lowercase, no #. Null when it is not a valid topic. */
export function normalizeTag(raw: string): string | null {
  const t = decodeURIComponent(raw).trim().replace(/^#+/, "").toLowerCase();
  return /^[\p{L}\p{N}_]{2,30}$/u.test(t) ? t : null;
}
