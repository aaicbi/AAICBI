import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  RegistrationInput, consentChannels, isReference, looksLikeBot, makeReference, normalizePhone, ownerKeyOf, registrationState, sanitizeTag,
  signatureMatches, sourceOf, suggestFreeCourses,
} from "@/lib/crm/registrationCore";

const good = {
  firstName: "Amaka", lastName: "Okon", email: " Amaka@Example.com ", phone: "0801 234 5678", country: "Nigeria", state: "Akwa Ibom", motivation: "To automate reports",
  agreementVersion: 1, agreementAccepted: true, signedName: "Amaka Okon", followUp: true, newsletter: false,
};

describe("phone numbers", () => {
  it("accepts international and Nigerian national formats", () => {
    expect(normalizePhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("0801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("2348012345678")).toBe("+2348012345678");
    expect(normalizePhone("00233 24 123 4567")).toBe("+233241234567");
  });
  it("rejects things that cannot be numbers", () => {
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });
});

describe("registration input", () => {
  it("accepts a good form and tidies it", () => {
    const r = RegistrationInput.parse(good);
    expect(r.email).toBe("amaka@example.com");
    expect(r.phone).toBe("+2348012345678");
  });
  it("needs the follow-up tick and the agreement tick", () => {
    expect(RegistrationInput.safeParse({ ...good, followUp: false }).success).toBe(false);
    expect(RegistrationInput.safeParse({ ...good, agreementAccepted: false }).success).toBe(false);
  });
  it("keeps the newsletter tick optional and separate", () => {
    expect(RegistrationInput.parse(good).newsletter).toBe(false);
    expect(RegistrationInput.parse({ ...good, newsletter: true }).newsletter).toBe(true);
  });
  it("blocks names that could carry markup or a spreadsheet formula", () => {
    expect(RegistrationInput.safeParse({ ...good, firstName: "<script>" }).success).toBe(false);
    expect(RegistrationInput.safeParse({ ...good, lastName: "=HYPERLINK(1)" }).success).toBe(false);
    expect(RegistrationInput.safeParse({ ...good, firstName: "Chidi-Ọ’Brien" }).success).toBe(true);
  });
  it("rejects a bad email and a bad number", () => {
    expect(RegistrationInput.safeParse({ ...good, email: "nope" }).success).toBe(false);
    expect(RegistrationInput.safeParse({ ...good, phone: "abc" }).success).toBe(false);
  });
});

describe("signature", () => {
  it("must contain both names, ignoring case, accents and a middle name", () => {
    expect(signatureMatches("amaka OKON", "Amaka", "Okon")).toBe(true);
    expect(signatureMatches("Amaka Grace Okon", "Amaka", "Okon")).toBe(true);
    expect(signatureMatches("Ámaka Okon", "Amaka", "Okon")).toBe(true);
    expect(signatureMatches("Amaka", "Amaka", "Okon")).toBe(false);
    expect(signatureMatches("Someone Else", "Amaka", "Okon")).toBe(false);
  });
});

describe("bot checks", () => {
  it("flags a filled hidden field or an impossibly fast form", () => {
    expect(looksLikeBot({ website: "http://spam" })).toBe(true);
    expect(looksLikeBot({ openedForMs: 800 })).toBe(true);
    expect(looksLikeBot({ website: "", openedForMs: 45000 })).toBe(false);
    expect(looksLikeBot({})).toBe(false);
  });
});

describe("source and tags", () => {
  it("cleans a tag and works out the source", () => {
    expect(sanitizeTag("Futybills Group!!")).toBe("futybillsgroup");
    expect(sanitizeTag("")).toBeNull();
    expect(sanitizeTag("a".repeat(100))?.length).toBe(40);
    expect(sourceOf({ fromTaster: true, tag: "qr" })).toBe("TASTER");
    expect(sourceOf({ fromTaster: false, tag: "qr-event" })).toBe("QR");
    expect(sourceOf({ fromTaster: false, tag: "whatsapp" })).toBe("LINK");
  });
});

describe("references and owners", () => {
  it("makes a readable, checkable reference", () => {
    const ref = makeReference(2026, () => 0.5);
    expect(isReference(ref)).toBe(true);
    expect(isReference("REG-2026-0O1I11")).toBe(false);
    expect(isReference("nonsense")).toBe(false);
  });
  it("keys AAICBI's own CRM apart from each organization's", () => {
    expect(ownerKeyOf(null)).toBe("PLATFORM");
    expect(ownerKeyOf("org1")).toBe("org1");
  });
  it("covers email and WhatsApp with the one follow-up tick", () => {
    expect(consentChannels(true)).toEqual(["EMAIL", "WHATSAPP"]);
    expect(consentChannels(false)).toEqual([]);
  });
});

describe("when a course takes registrations", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterAll(() => { vi.useRealTimers(); });
  const base = { status: "PUBLISHED", registrationEnabled: false, capacity: null as number | null, startDate: null as Date | null, registrationDeadline: null as Date | null };
  it("opens a published coming-soon course", () => {
    expect(registrationState({ ...base, startDate: new Date("2026-11-10") }, 0, now)).toEqual({ open: true });
  });
  it("needs the staff switch when the course is not scheduled", () => {
    expect(registrationState(base, 0, now)).toEqual({ open: false, reason: "NOT_AVAILABLE" });
    expect(registrationState({ ...base, registrationEnabled: true }, 0, now)).toEqual({ open: true });
  });
  it("closes at the deadline, at the start and when full", () => {
    expect(registrationState({ ...base, registrationEnabled: true, registrationDeadline: new Date("2026-10-20") }, 0, now)).toEqual({ open: false, reason: "CLOSED" });
    expect(registrationState({ ...base, startDate: new Date("2026-10-01") }, 0, now)).toEqual({ open: false, reason: "NOT_AVAILABLE" });
    expect(registrationState({ ...base, registrationEnabled: true, startDate: new Date("2026-10-01") }, 0, now)).toEqual({ open: true });
    expect(registrationState({ ...base, registrationEnabled: true, startDate: new Date("2026-09-01"), endDate: new Date("2026-10-10") }, 0, now)).toEqual({ open: false, reason: "CLOSED" });
    expect(registrationState({ ...base, registrationEnabled: true, capacity: 5 }, 5, now)).toEqual({ open: false, reason: "FULL" });
  });
  it("never opens a draft", () => {
    expect(registrationState({ ...base, status: "DRAFT", registrationEnabled: true }, 0, now)).toEqual({ open: false, reason: "NOT_AVAILABLE" });
  });
});

describe("free course suggestions", () => {
  const list = [
    { id: "a", title: "Alpha", category: "Tech", enrolled: 5 },
    { id: "b", title: "Beta", category: "Business", enrolled: 50 },
    { id: "c", title: "Gamma", category: "Tech", enrolled: 20 },
    { id: "d", title: "Delta", category: null, enrolled: 1 },
  ];
  it("puts the same category first, then the most popular", () => {
    expect(suggestFreeCourses(list, { excludeIds: [], category: "tech" }).map((c) => c.id)).toEqual(["c", "a", "b"]);
  });
  it("skips excluded courses and respects the limit", () => {
    expect(suggestFreeCourses(list, { excludeIds: ["c"], category: "Tech", limit: 2 }).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
