/**
 * Follow-up messages to people who saved their taster score, as pure functions (no database, no network).
 *
 * Four messages, each sent at most once per person: a welcome, two reminders to start module 1 while they have not
 * (the second is the last), and a nudge to finish module 1 once they have started it. Nothing is sent to someone who
 * opted out, who already paid, or in quiet hours (21:00 to 07:00 in Nigeria). Every message carries a stop link.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const MESSAGE_KINDS = ["WELCOME", "REMINDER_1", "REMINDER_2", "FINISH_MODULE_1"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export const KIND_LABEL: Record<MessageKind, string> = {
  WELCOME: "Welcome (right after saving)",
  REMINDER_1: "Reminder 1 (a day later, not started)",
  REMINDER_2: "Reminder 2, the last (three days later, not started)",
  FINISH_MODULE_1: "Finish Module 1 (two days after starting)",
};

export type Channel = "MANUAL" | "WHATSAPP" | "EMAIL";
export const CHANNELS: Channel[] = ["MANUAL", "WHATSAPP", "EMAIL"];

export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "SKIPPED" | "MANUAL_PENDING" | "MANUAL_SENT";

/** Hours after the lead was saved (or, for FINISH_MODULE_1, after they started module 1) before a message is due. */
export const DELAY_HOURS: Record<MessageKind, number> = { WELCOME: 0, REMINDER_1: 24, REMINDER_2: 72, FINISH_MODULE_1: 48 };
/** Never two messages to one person closer together than this (the welcome is exempt as the first). */
export const MIN_GAP_HOURS = 20;
/** A welcome goes out within this many hours of saving, or not at all. */
export const WELCOME_WINDOW_HOURS = 48;
/** Leads older than this get nothing more. */
export const LEAD_WINDOW_DAYS = 14;
export const DEFAULT_DAILY_CAP = 200;
export const DEFAULT_QUIET = { start: 21, end: 7 };
/** Nigeria has no daylight saving: West Africa Time is always UTC+1. */
export const WAT_OFFSET_HOURS = 1;

export interface LeadState {
  createdAt: Date;
  optedOutAt: Date | null;
  /** Set once they continued into module 1 as a trainee. */
  claimedAt: Date | null;
  /** They have an unlocked (paid or otherwise full) enrollment. */
  hasFullAccess: boolean;
  /** They finished module 1. */
  module1Done: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
}

export interface SentRecord { kind: MessageKind; at: Date | null }

const hours = (ms: number) => ms / 3_600_000;

/** The one message that is due for this person now, or null. Everything that stops messaging is checked here. */
export function dueKind(lead: LeadState, sent: SentRecord[], now: Date): MessageKind | null {
  if (lead.optedOutAt || lead.hasFullAccess) return null;
  if (!lead.hasPhone && !lead.hasEmail) return null;
  if (hours(now.getTime() - lead.createdAt.getTime()) > LEAD_WINDOW_DAYS * 24) return null;
  const has = new Set(sent.map((s) => s.kind));
  const last = sent.reduce<Date | null>((acc, s) => (s.at && (!acc || s.at > acc) ? s.at : acc), null);
  const gapOk = !last || hours(now.getTime() - last.getTime()) >= MIN_GAP_HOURS;
  const age = hours(now.getTime() - lead.createdAt.getTime());

  // A welcome is only worth sending soon after they saved. Someone who saved while messaging was off is never greeted days later.
  if (!has.has("WELCOME")) return age <= WELCOME_WINDOW_HOURS ? "WELCOME" : null;
  if (!gapOk) return null;
  if (lead.claimedAt) {
    if (!lead.module1Done && !has.has("FINISH_MODULE_1") && hours(now.getTime() - lead.claimedAt.getTime()) >= DELAY_HOURS.FINISH_MODULE_1) return "FINISH_MODULE_1";
    return null;
  }
  if (!has.has("REMINDER_1") && age >= DELAY_HOURS.REMINDER_1) return "REMINDER_1";
  if (has.has("REMINDER_1") && !has.has("REMINDER_2") && age >= DELAY_HOURS.REMINDER_2) return "REMINDER_2";
  return null;
}

// ---------------------------------------------------------------- quiet hours

export interface Quiet { start: number; end: number }

/** Quiet hours are whole hours in Nigerian time. Equal start and end means no quiet hours. */
export function inQuietHours(now: Date, quiet: Quiet = DEFAULT_QUIET): boolean {
  if (quiet.start === quiet.end) return false;
  const hour = (now.getUTCHours() + WAT_OFFSET_HOURS + 24) % 24;
  return quiet.start < quiet.end ? hour >= quiet.start && hour < quiet.end : hour >= quiet.start || hour < quiet.end;
}

export function cleanQuiet(raw: unknown): Quiet {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ok = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback);
  return { start: ok(r.start, DEFAULT_QUIET.start), end: ok(r.end, DEFAULT_QUIET.end) };
}

// ---------------------------------------------------------------- the words

export const PLACEHOLDERS = ["name", "rank", "course", "link", "stop"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export const BODY_MAX = 700;

export interface TemplateDef { body: string; waTemplate: string }

export const DEFAULT_TEMPLATES: Record<MessageKind, TemplateDef> = {
  WELCOME: { body: "Hi {name}! Your {rank} result on the {course} taster is saved. Module 1 is free, no payment needed: {link}  To stop messages: {stop}", waTemplate: "aaicbi_taster_welcome" },
  REMINDER_1: { body: "Hi {name}, your free Module 1 of {course} is still waiting. Pick up where your {rank} result left off: {link}  To stop messages: {stop}", waTemplate: "aaicbi_taster_reminder_1" },
  REMINDER_2: { body: "Hi {name}, last reminder: Module 1 of {course} is free to start whenever you are ready ({rank} is a good start): {link}  To stop messages: {stop}", waTemplate: "aaicbi_taster_reminder_2" },
  FINISH_MODULE_1: { body: "Hi {name}, you started Module 1 of {course}. A little more and you will have finished it ({rank}): {link}  To stop messages: {stop}", waTemplate: "aaicbi_taster_finish_module_1" },
};

export type TemplateCheck = { ok: true; body: string; waTemplate: string } | { ok: false; error: string };

/** A custom message must be short, must carry the stop link, and may only use the known placeholders. */
export function checkTemplate(input: { body?: unknown; waTemplate?: unknown }): TemplateCheck {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) return { ok: false, error: "The message cannot be empty." };
  if (body.length > BODY_MAX) return { ok: false, error: `The message is over ${BODY_MAX} characters.` };
  if (!body.includes("{stop}")) return { ok: false, error: "Every message must include {stop}, the link to stop messages." };
  const unknown = [...body.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]).filter((n) => !(PLACEHOLDERS as readonly string[]).includes(n));
  if (unknown.length) return { ok: false, error: `Unknown placeholder {${unknown[0]}}. Use {name}, {rank}, {course}, {link} and {stop}.` };
  const wa = typeof input.waTemplate === "string" ? input.waTemplate.trim() : "";
  if (wa && !/^[a-z0-9_]{1,512}$/.test(wa)) return { ok: false, error: "A WhatsApp template name uses lowercase letters, numbers and underscores only." };
  return { ok: true, body, waTemplate: wa };
}

export interface RenderVars { name: string | null; rank: string; course: string; link: string; stop: string }

/** The first name part of a nickname, or "there". */
export const greetingName = (nickname: string | null | undefined) => (nickname ? nickname.split(" ")[0] : "there");

export function renderMessage(body: string, v: RenderVars): string {
  const map: Record<Placeholder, string> = { name: greetingName(v.name), rank: v.rank, course: v.course, link: v.link, stop: v.stop };
  return body.replace(/\{([a-z]+)\}/g, (all, k: string) => (k in map ? map[k as Placeholder] : all));
}

/** WhatsApp templates take positional variables {{1}}..{{5}} in this fixed order. */
export function whatsAppVariables(v: RenderVars): Record<string, string> {
  return { "1": greetingName(v.name), "2": v.rank, "3": v.course, "4": v.link, "5": v.stop };
}

/** The text to register with Meta for a template: the same message with {{1}}..{{5}} in place of the placeholders. */
export function metaTemplateText(body: string): string {
  const order: Placeholder[] = ["name", "rank", "course", "link", "stop"];
  return body.replace(/\{([a-z]+)\}/g, (all, k: string) => { const i = order.indexOf(k as Placeholder); return i >= 0 ? `{{${i + 1}}}` : all; });
}

export const waMeLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

// ---------------------------------------------------------------- inbound (WhatsApp webhook)

const STOP_WORDS = ["stop", "unsubscribe", "cancel", "end", "quit", "stopall", "opt out", "optout"];
export const isStopWord = (text: unknown): boolean => typeof text === "string" && STOP_WORDS.includes(text.trim().toLowerCase().replace(/[.!]+$/g, ""));

export interface WebhookStatus { id: string; status: "sent" | "delivered" | "read" | "failed"; error: string | null }
export interface ParsedWebhook { statuses: WebhookStatus[]; optOutPhones: string[] }

/** Reads Meta's webhook payload for delivery updates and for "STOP" replies. Anything it does not recognize is ignored. */
export function parseWhatsAppWebhook(payload: unknown): ParsedWebhook {
  const out: ParsedWebhook = { statuses: [], optOutPhones: [] };
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    const changes = (e as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      const value = (c as { value?: Record<string, unknown> })?.value;
      if (!value) continue;
      for (const s of Array.isArray(value.statuses) ? (value.statuses as Record<string, unknown>[]) : []) {
        const st = s.status;
        if (typeof s.id === "string" && (st === "sent" || st === "delivered" || st === "read" || st === "failed")) {
          const err = Array.isArray(s.errors) ? (s.errors[0] as Record<string, unknown> | undefined) : undefined;
          out.statuses.push({ id: s.id, status: st, error: err && typeof err.title === "string" ? err.title.slice(0, 200) : null });
        }
      }
      for (const m of Array.isArray(value.messages) ? (value.messages as Record<string, unknown>[]) : []) {
        const text = (m.text as { body?: unknown } | undefined)?.body;
        if (typeof m.from === "string" && /^\d{6,16}$/.test(m.from) && isStopWord(text)) out.optOutPhones.push(`+${m.from}`);
      }
    }
  }
  return out;
}

/** Meta signs each webhook body with the app secret: `sha256=<hex hmac>` in X-Hub-Signature-256. */
export function signatureValid(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** How a message's status should move on a delivery update: it only ever moves forward. */
const RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };
export function nextStatus(current: MessageStatus, update: WebhookStatus["status"]): MessageStatus {
  if (update === "failed") return current === "READ" || current === "DELIVERED" ? current : "FAILED";
  const target = update.toUpperCase() as MessageStatus;
  return (RANK[target] ?? -1) > (RANK[current] ?? -1) ? target : current;
}
