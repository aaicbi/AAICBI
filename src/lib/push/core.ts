import { z } from "zod";

/** Pure rules for web push: what may be sent, and what a subscription must look like. */

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Notification types whose text is private (a person's own words): the push says only that something arrived. */
const PRIVATE_TYPES = new Set(["MESSAGE_TO_ADMIN"]);
const MAX_TITLE = 80;
const MAX_BODY = 120;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * The push message for a notification. It carries a short title and line and
 * a page address, nothing else, and never the text of a private message. The
 * address must be a path on this site so a push can never open another site.
 */
export function buildPushPayload(n: { type: string; title: string; body: string; url?: string | null }): PushPayload {
  const isPrivate = PRIVATE_TYPES.has(n.type) || /MESSAGE|CHAT/.test(n.type);
  const safeUrl = typeof n.url === "string" && n.url.startsWith("/") && !n.url.startsWith("//") ? n.url : "/notifications";
  return {
    title: clip(n.title, MAX_TITLE) || "AAICBI",
    body: isPrivate ? "Open the app to read it." : clip(n.body, MAX_BODY),
    url: safeUrl,
    tag: n.type,
  };
}

export const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Push endpoints must use https."),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }),
});
export const UnsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

/** Per account, so one person cannot fill the table with endpoints. */
export const MAX_SUBSCRIPTIONS_PER_ACCOUNT = 10;
