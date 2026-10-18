import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BODY_MAX, DEFAULT_TEMPLATES, LEAD_WINDOW_DAYS, MESSAGE_KINDS, cleanQuiet, checkTemplate, dueKind, greetingName, inQuietHours, isStopWord, metaTemplateText, nextStatus,
  parseWhatsAppWebhook, renderMessage, signatureValid, waMeLink, whatsAppVariables, type LeadState, type SentRecord,
} from "@/lib/growth/messagingCore";

const T0 = new Date("2026-03-01T10:00:00Z");
const at = (h: number) => new Date(T0.getTime() + h * 3_600_000);
const lead = (over: Partial<LeadState> = {}): LeadState => ({ createdAt: T0, optedOutAt: null, claimedAt: null, hasFullAccess: false, module1Done: false, hasPhone: true, hasEmail: false, ...over });
const sent = (...rows: [string, number][]): SentRecord[] => rows.map(([kind, h]) => ({ kind: kind as SentRecord["kind"], at: at(h) }));

describe("which message is due", () => {
  it("sends the welcome first, immediately", () => expect(dueKind(lead(), [], at(0))).toBe("WELCOME"));
  it("waits a day, then three days, for the reminders", () => {
    expect(dueKind(lead(), sent(["WELCOME", 0]), at(23))).toBeNull();
    expect(dueKind(lead(), sent(["WELCOME", 0]), at(25))).toBe("REMINDER_1");
    expect(dueKind(lead(), sent(["WELCOME", 0], ["REMINDER_1", 25]), at(60))).toBeNull();
    expect(dueKind(lead(), sent(["WELCOME", 0], ["REMINDER_1", 25]), at(73))).toBe("REMINDER_2");
  });
  it("never sends the same message twice and stops after the last reminder", () => {
    expect(dueKind(lead(), sent(["WELCOME", 0], ["REMINDER_1", 25], ["REMINDER_2", 73]), at(200))).toBeNull();
  });
  it("keeps a gap between messages", () => {
    // reminder 1 sent late (at 60h): reminder 2 is due by age at 73h but the gap is not yet 20h
    expect(dueKind(lead(), sent(["WELCOME", 0], ["REMINDER_1", 60]), at(73))).toBeNull();
    expect(dueKind(lead(), sent(["WELCOME", 0], ["REMINDER_1", 60]), at(81))).toBe("REMINDER_2");
  });
  it("stops for someone who opted out or already has full access", () => {
    expect(dueKind(lead({ optedOutAt: at(1) }), [], at(2))).toBeNull();
    expect(dueKind(lead({ hasFullAccess: true }), [], at(2))).toBeNull();
  });
  it("needs a way to reach them", () => {
    expect(dueKind(lead({ hasPhone: false, hasEmail: false }), [], at(0))).toBeNull();
    expect(dueKind(lead({ hasPhone: false, hasEmail: true }), [], at(0))).toBe("WELCOME");
  });
  it("sends nothing to an old lead", () => {
    expect(dueKind(lead(), [], at(LEAD_WINDOW_DAYS * 24 + 1))).toBeNull();
  });
  it("switches to the finish nudge once they started module 1", () => {
    const l = lead({ claimedAt: at(5) });
    expect(dueKind(l, sent(["WELCOME", 0]), at(30))).toBeNull();
    expect(dueKind(l, sent(["WELCOME", 0]), at(54))).toBe("FINISH_MODULE_1");
    expect(dueKind({ ...l, module1Done: true }, sent(["WELCOME", 0]), at(54))).toBeNull();
    expect(dueKind(l, sent(["WELCOME", 0], ["FINISH_MODULE_1", 54]), at(120))).toBeNull();
  });
  it("lists four kinds", () => expect(MESSAGE_KINDS).toHaveLength(4));
});

describe("quiet hours", () => {
  const utc = (h: number) => new Date(Date.UTC(2026, 2, 1, h, 30));
  it("is 21:00 to 07:00 in Nigeria (UTC+1)", () => {
    expect(inQuietHours(utc(20))).toBe(true); // 21:30 WAT
    expect(inQuietHours(utc(19))).toBe(false); // 20:30 WAT
    expect(inQuietHours(utc(3))).toBe(true); // 04:30 WAT
    expect(inQuietHours(utc(6))).toBe(false); // 07:30 WAT, already open
  });
  it("opens at 07:00", () => {
    expect(inQuietHours(new Date(Date.UTC(2026, 2, 1, 5, 59)))).toBe(true); // 06:59 WAT
    expect(inQuietHours(new Date(Date.UTC(2026, 2, 1, 6, 0)))).toBe(false); // 07:00 WAT
  });
  it("can be switched off and cleaned", () => {
    expect(inQuietHours(utc(23), { start: 0, end: 0 })).toBe(false);
    expect(cleanQuiet({ start: 22, end: 6 })).toEqual({ start: 22, end: 6 });
    expect(cleanQuiet({ start: 99, end: "x" })).toEqual({ start: 21, end: 7 });
    expect(cleanQuiet(null)).toEqual({ start: 21, end: 7 });
  });
});

describe("the words", () => {
  const vars = { name: "Ada Okoro", rank: "Silver Automator", course: "AI Automation", link: "https://x.test/l", stop: "https://x.test/s" };
  it("fills the placeholders", () => {
    expect(renderMessage("Hi {name}, {rank}, {course}: {link} stop {stop}", vars)).toBe("Hi Ada, Silver Automator, AI Automation: https://x.test/l stop https://x.test/s");
    expect(greetingName(null)).toBe("there");
    expect(renderMessage("Hi {name} {unknown}", { ...vars, name: null })).toBe("Hi there {unknown}");
  });
  it("orders WhatsApp variables 1 to 5", () => {
    expect(whatsAppVariables(vars)).toEqual({ "1": "Ada", "2": "Silver Automator", "3": "AI Automation", "4": "https://x.test/l", "5": "https://x.test/s" });
  });
  it("shows the text to register with Meta", () => {
    expect(metaTemplateText("Hi {name}, {rank}, {course}: {link} stop {stop}")).toBe("Hi {{1}}, {{2}}, {{3}}: {{4}} stop {{5}}");
  });
  it("builds a click-to-chat link", () => {
    expect(waMeLink("+2348031234567", "Hi there & you")).toBe("https://wa.me/2348031234567?text=Hi%20there%20%26%20you");
  });
  it("accepts every default message", () => {
    for (const k of MESSAGE_KINDS) {
      const c = checkTemplate(DEFAULT_TEMPLATES[k]);
      expect(c.ok).toBe(true);
      expect(DEFAULT_TEMPLATES[k].body).toMatch(/\{name\}.*\{course\}.*\{link\}.*\{stop\}|\{name\}.*\{link\}.*\{stop\}/);
    }
  });
  it("refuses a message without the stop link, with unknown placeholders, or too long", () => {
    expect(checkTemplate({ body: "Hi {name} {link}" }).ok).toBe(false);
    expect(checkTemplate({ body: "Hi {nme} {stop}" })).toEqual({ ok: false, error: "Unknown placeholder {nme}. Use {name}, {rank}, {course}, {link} and {stop}." });
    expect(checkTemplate({ body: "   " }).ok).toBe(false);
    expect(checkTemplate({ body: "{stop}" + "x".repeat(BODY_MAX) }).ok).toBe(false);
    expect(checkTemplate({ body: "{stop}", waTemplate: "Bad Name" }).ok).toBe(false);
    expect(checkTemplate({ body: "{stop}", waTemplate: "good_name_1" }).ok).toBe(true);
  });
});

describe("the WhatsApp webhook", () => {
  const payload = {
    entry: [{ changes: [{ value: {
      statuses: [{ id: "wamid.A", status: "delivered" }, { id: "wamid.B", status: "failed", errors: [{ title: "Re-engagement message" }] }, { id: "wamid.C", status: "weird" }],
      messages: [{ from: "2348031234567", text: { body: " STOP. " } }, { from: "2349000000000", text: { body: "hello" } }, { from: "notanumber", text: { body: "stop" } }],
    } }] }],
  };
  it("reads delivery updates and stop replies", () => {
    expect(parseWhatsAppWebhook(payload)).toEqual({
      statuses: [{ id: "wamid.A", status: "delivered", error: null }, { id: "wamid.B", status: "failed", error: "Re-engagement message" }],
      optOutPhones: ["+2348031234567"],
    });
  });
  it("ignores anything else", () => {
    expect(parseWhatsAppWebhook(null)).toEqual({ statuses: [], optOutPhones: [] });
    expect(parseWhatsAppWebhook({ entry: "x" })).toEqual({ statuses: [], optOutPhones: [] });
    expect(parseWhatsAppWebhook({ entry: [{ changes: [{}] }] })).toEqual({ statuses: [], optOutPhones: [] });
  });
  it("recognizes stop words", () => {
    for (const w of ["stop", "STOP", " Unsubscribe ", "cancel", "Stop!"]) expect(isStopWord(w)).toBe(true);
    for (const w of ["please do not stop", "go", "", 5, null]) expect(isStopWord(w)).toBe(false);
  });
  it("checks the signature", () => {
    const body = JSON.stringify(payload);
    const good = "sha256=" + createHmac("sha256", "sekret").update(body).digest("hex");
    expect(signatureValid(body, good, "sekret")).toBe(true);
    expect(signatureValid(body, good, "other")).toBe(false);
    expect(signatureValid(body + " ", good, "sekret")).toBe(false);
    expect(signatureValid(body, null, "sekret")).toBe(false);
    expect(signatureValid(body, "sha256=zz", "sekret")).toBe(false);
    expect(signatureValid(body, good, "")).toBe(false);
  });
  it("moves a status forward only", () => {
    expect(nextStatus("SENT", "delivered")).toBe("DELIVERED");
    expect(nextStatus("DELIVERED", "read")).toBe("READ");
    expect(nextStatus("READ", "delivered")).toBe("READ");
    expect(nextStatus("SENT", "failed")).toBe("FAILED");
    expect(nextStatus("DELIVERED", "failed")).toBe("DELIVERED");
    expect(nextStatus("SENT", "sent")).toBe("SENT");
  });
});
