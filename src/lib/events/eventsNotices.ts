import { formatWhen } from "@/lib/events/eventsCore";

/**
 * The wording of every Event Manager notification. Pure, so the text is tested. Notices say what happened and when, in the event's own
 * time zone, and never contain a meeting link or passcode: the link is shown only on the event page to people allowed to join.
 */
export type NoticeKind =
  | "PUBLISHED" | "INVITED" | "REMINDER_DAY" | "REMINDER_HOUR" | "RESCHEDULED" | "CANCELLED"
  | "PROMOTION_SUBMITTED" | "PROMOTION_APPROVED" | "PROMOTION_REJECTED" | "PROMOTION_CHANGES" | "PROMOTION_PUBLISHED" | "PROMOTION_PULLED"
  | "REGISTERED" | "REGISTRATION_PENDING" | "REGISTRATION_CONFIRMED" | "REGISTRATION_DECLINED" | "REGISTRATION_REQUEST";

export interface NoticeEvent { id: string; title: string; startsAt: Date; endsAt: Date; timeZone: string; organizer: string }
export interface Notice { type: string; title: string; body: string; url: string }

export const eventPath = (id: string) => `/events/${id}`;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function noticeFor(kind: NoticeKind, e: NoticeEvent, extra: { reason?: string | null; who?: string; manageUrl?: string } = {}): Notice {
  const when = formatWhen(e.startsAt, e.endsAt, e.timeZone);
  const url = eventPath(e.id);
  const t = clip(e.title, 80);
  const reason = extra.reason ? ` Reason: ${clip(extra.reason, 200)}` : "";
  switch (kind) {
    case "PUBLISHED": return { type: "EVENT_PUBLISHED", title: `New event: ${t}`, body: `${e.organizer} invites you. ${when}.`, url };
    case "INVITED": return { type: "EVENT_INVITED", title: `You are invited: ${t}`, body: `${e.organizer} scheduled this for you. ${when}.`, url };
    case "REMINDER_DAY": return { type: "EVENT_REMINDER", title: `Tomorrow: ${t}`, body: `${when}.`, url };
    case "REMINDER_HOUR": return { type: "EVENT_REMINDER", title: `Starting soon: ${t}`, body: `${when}. Open the event for how to join.`, url };
    case "RESCHEDULED": return { type: "EVENT_RESCHEDULED", title: `Rescheduled: ${t}`, body: `New time: ${when}.`, url };
    case "CANCELLED": return { type: "EVENT_CANCELLED", title: `Cancelled: ${t}`, body: `${e.organizer} cancelled this event.${reason}`, url };
    case "PROMOTION_SUBMITTED": return { type: "EVENT_PROMOTION", title: `Promotion request: ${t}`, body: `${extra.who ?? e.organizer} asks AAICBI to promote this event. ${when}.`, url: extra.manageUrl ?? url };
    case "PROMOTION_APPROVED": return { type: "EVENT_PROMOTION", title: `Approved for promotion: ${t}`, body: "AAICBI approved your event for public promotion. It will appear on the public pages when it is published.", url: extra.manageUrl ?? url };
    case "PROMOTION_PUBLISHED": return { type: "EVENT_PROMOTION", title: `Now published: ${t}`, body: "Your event is live on the AAICBI Ecosystem pages.", url };
    case "PROMOTION_REJECTED": return { type: "EVENT_PROMOTION", title: `Promotion declined: ${t}`, body: `AAICBI did not approve public promotion. Your internal event is not affected.${reason}`, url: extra.manageUrl ?? url };
    case "PROMOTION_CHANGES": return { type: "EVENT_PROMOTION", title: `Changes requested: ${t}`, body: `AAICBI asks you to update the event before it can be promoted.${reason}`, url: extra.manageUrl ?? url };
    case "PROMOTION_PULLED": return { type: "EVENT_PROMOTION", title: `Taken off the public pages: ${t}`, body: `AAICBI removed this event from the public pages. Your internal event is not affected.${reason}`, url: extra.manageUrl ?? url };
    case "REGISTERED": return { type: "EVENT_REGISTRATION", title: `You are registered: ${t}`, body: `${when}.`, url };
    case "REGISTRATION_PENDING": return { type: "EVENT_REGISTRATION", title: `Registration received: ${t}`, body: "The organiser will confirm your place.", url };
    case "REGISTRATION_CONFIRMED": return { type: "EVENT_REGISTRATION", title: `Your place is confirmed: ${t}`, body: `${when}.`, url };
    case "REGISTRATION_DECLINED": return { type: "EVENT_REGISTRATION", title: `Registration not accepted: ${t}`, body: `The organiser could not accept your registration.${reason}`, url };
    case "REGISTRATION_REQUEST": return { type: "EVENT_REGISTRATION", title: `New registration to review: ${t}`, body: `${extra.who ?? "Someone"} asked to attend.`, url: extra.manageUrl ?? url };
  }
}

// ---------------------------------------------------------------------------------------------------------------- email

/**
 * Which notices are also sent by email. Only things about one person's own plans or requests, never the platform-wide "a new public event was
 * published" announcement (that stays in the app). Email carries the same words as the in-app notice and a link to the event page: never a
 * meeting link or passcode.
 */
export const EMAIL_KINDS = new Set<string>([
  "INVITED", "REMINDER_DAY", "REMINDER_HOUR", "RESCHEDULED", "CANCELLED", "REGISTERED", "REGISTRATION_PENDING", "REGISTRATION_CONFIRMED", "REGISTRATION_DECLINED", "REGISTRATION_REQUEST",
  "PROMOTION_SUBMITTED", "PROMOTION_APPROVED", "PROMOTION_REJECTED", "PROMOTION_CHANGES", "PROMOTION_PUBLISHED", "PROMOTION_PULLED",
]);
/** Above this many recipients a notice stays in the app only: email is for people an event is aimed at, not for a crowd. */
export const EMAIL_RECIPIENT_LIMIT = 500;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function noticeEmail(n: Notice, baseUrl: string): { subject: string; html: string; text: string } {
  const link = `${baseUrl.replace(/\/$/, "")}${n.url.startsWith("/") ? n.url : `/${n.url}`}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F7F4EE;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;"><div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
<p style="margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:0.05em;color:#016B61;text-transform:uppercase;">AAICBI Events</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${esc(n.title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;">${esc(n.body)}</p>
<p style="margin:24px 0;"><a href="${esc(link)}" style="display:inline-block;background:#016B61;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;">Open the event</a></p>
<p style="margin:0 0 16px;font-size:12px;color:#888;word-break:break-all;">If the button does not work, copy this link: ${esc(link)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#888;">You are receiving this because of an event on the AAICBI Ecosystem. Joining details are only shown on the event page, after you sign in.</p>
</div></body></html>`;
  return { subject: n.title, html, text: `${n.title}\n\n${n.body}\n\nOpen the event: ${link}\n\nJoining details are only shown on the event page, after you sign in.` };
}
