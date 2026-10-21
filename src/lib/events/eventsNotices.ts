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
