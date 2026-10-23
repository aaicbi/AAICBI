import { z } from "zod";
import { getCourseLifecyclePhase, type ScheduleFields } from "@/lib/courseLifecycle";

/**
 * Course registration rules, pure (no database), so every rule here is tested. See docs/crm-registration.md.
 *
 * A registration is a pre-registration: it records interest, consent to be followed up and a signed agreement. It is not an admission and
 * it takes no payment.
 */

export const PLATFORM_OWNER = "PLATFORM";
export const STAGES = ["REGISTERED", "CONTACTED", "INTERESTED", "ENROLLED", "WITHDRAWN"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { REGISTERED: "Registered", CONTACTED: "Contacted", INTERESTED: "Interested", ENROLLED: "Enrolled", WITHDRAWN: "Withdrawn" };
export const SOURCES = ["LINK", "TASTER", "QR", "OTHER"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = { LINK: "Link", TASTER: "Taster game", QR: "QR code", OTHER: "Other" };

/** The key a contact is unique under: the organization's id, or "PLATFORM" for AAICBI's own CRM. */
export const ownerKeyOf = (organizationId: string | null | undefined): string => organizationId || PLATFORM_OWNER;

export const normalizeEmail = (v: string): string => v.trim().toLowerCase();

const collapse = (v: string): string => v.replace(/\s+/g, " ").trim();

/**
 * A phone number as +<digits>. Accepts "+234 801 234 5678", "2348012345678" and a Nigerian national number "0801 234 5678". Returns null when it
 * cannot be a real number (too short, too long, letters).
 */
export function normalizePhone(raw: string, defaultCountryCode = "234"): string | null {
  const cleaned = raw.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;
  let digits: string;
  if (cleaned.startsWith("+")) digits = cleaned.slice(1);
  else if (cleaned.startsWith("00")) digits = cleaned.slice(2);
  else if (cleaned.startsWith("0")) digits = defaultCountryCode + cleaned.slice(1);
  else digits = cleaned;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Letters, spaces, hyphens, apostrophes and full stops: names from anywhere, but nothing that can carry markup or a spreadsheet formula. */
const NAME = /^[\p{L}][\p{L}\p{M} .'’-]*$/u;
const personName = z.string().transform(collapse).pipe(z.string().min(1, "Enter your name.").max(60, "That name is too long.").regex(NAME, "Use letters only for your name."));

export const RegistrationInput = z.object({
  firstName: personName,
  lastName: personName,
  email: z.string().transform((v) => normalizeEmail(v)).pipe(z.string().email("Enter a valid email address.").max(160)),
  phone: z.string().max(30).transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a WhatsApp number with the country code, like +234 801 234 5678." });
    return n ?? "";
  }),
  country: z.string().transform(collapse).pipe(z.string().min(2, "Choose your country.").max(60)),
  state: z.string().transform(collapse).pipe(z.string().max(60)).optional().default(""),
  motivation: z.string().transform((v) => v.trim()).pipe(z.string().max(600, "Please keep this under 600 characters.")).optional().default(""),
  agreementVersion: z.number().int().positive(),
  agreementAccepted: z.literal(true, { errorMap: () => ({ message: "Tick the box to agree to the agreement." }) }),
  signedName: z.string().transform(collapse).pipe(z.string().min(3, "Type your full name to sign.").max(120)),
  followUp: z.literal(true, { errorMap: () => ({ message: "Tick the box so we can contact you about this course." }) }),
  newsletter: z.boolean().optional().default(false),
  /** Anti-bot: a field real people never see or fill. */
  website: z.string().max(200).optional().default(""),
  /** Seconds the form was open, for a too-fast-to-be-human check. */
  openedForMs: z.number().int().nonnegative().max(1000 * 60 * 60 * 24).optional(),
  src: z.string().max(80).nullish(),
  play: z.string().max(80).nullish(),
});
export type RegistrationInputT = z.infer<typeof RegistrationInput>;

/** The typed signature must contain both the first and the last name the person gave (middle names are fine), ignoring case and accents. */
export function signatureMatches(signedName: string, firstName: string, lastName: string): boolean {
  const fold = (s: string) => collapse(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const signed = fold(signedName).split(" ");
  return fold(firstName).split(" ").every((p) => signed.includes(p)) && fold(lastName).split(" ").every((p) => signed.includes(p));
}

/** A form submitted by a script: the hidden field is filled, or it was open for under 3 seconds. */
export function looksLikeBot(input: { website?: string; openedForMs?: number }): boolean {
  if (input.website && input.website.trim() !== "") return true;
  return input.openedForMs !== undefined && input.openedForMs < 3000;
}

export const TAG_MAX = 40;
/** A ?src= tag, lower-cased and limited to letters, digits, hyphen and underscore. */
export function sanitizeTag(v: string | null | undefined): string | null {
  const t = (v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, TAG_MAX);
  return t || null;
}

export function sourceOf(opts: { fromTaster: boolean; tag: string | null }): Source {
  if (opts.fromTaster) return "TASTER";
  if (opts.tag && (opts.tag === "qr" || opts.tag.startsWith("qr-") || opts.tag.startsWith("qr_"))) return "QR";
  return "LINK";
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** REG-2026-K7M2QX. `random` returns a number in [0, 1) (injected so the rule is testable). */
export function makeReference(year: number, random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)];
  return `REG-${year}-${s}`;
}
export const isReference = (v: string): boolean => /^REG-\d{4}-[A-HJ-NP-Z2-9]{6}$/.test(v);

export interface CourseForRegistration extends ScheduleFields {
  status: string;
  registrationEnabled: boolean;
  capacity: number | null;
}

export type RegistrationState =
  | { open: true }
  | { open: false; reason: "NOT_AVAILABLE" | "CLOSED" | "FULL" };

export const CLOSED_MESSAGE: Record<Exclude<RegistrationState, { open: true }>["reason"], string> = {
  NOT_AVAILABLE: "Registration is not open for this course.",
  CLOSED: "Registration for this course has closed.",
  FULL: "This course is full.",
};

/**
 * Whether a course takes registrations right now. It must be published (or reachable by link), and be either a scheduled "coming soon" /
 * "registration open" course or one a staff member switched on. A deadline in the past, a start in the past or a full course closes it.
 */
export function registrationState(course: CourseForRegistration, registered: number, now: Date = new Date()): RegistrationState {
  if (course.status !== "PUBLISHED" && course.status !== "UNLISTED") return { open: false, reason: "NOT_AVAILABLE" };
  const phase = getCourseLifecyclePhase(course);
  const scheduledOpen = phase === "COMING_SOON" || phase === "REGISTRATION_OPEN";
  if (!scheduledOpen && !course.registrationEnabled) return { open: false, reason: "NOT_AVAILABLE" };
  // A staff switch keeps a rolling course open after its start date; a finished course is always closed.
  if (phase === "COMPLETED") return { open: false, reason: "CLOSED" };
  if (phase === "REGISTRATION_CLOSED") return { open: false, reason: "CLOSED" };
  if (course.registrationDeadline && now.getTime() >= new Date(course.registrationDeadline).getTime()) return { open: false, reason: "CLOSED" };
  if (course.capacity != null && registered >= course.capacity) return { open: false, reason: "FULL" };
  return { open: true };
}

export interface FreeCourseCandidate {
  id: string;
  title: string;
  category: string | null;
  enrolled: number;
}

/**
 * Up to `limit` free courses to try while waiting: same category first, then the most popular. Never the course being registered for, and
 * never one the person already took.
 */
export function suggestFreeCourses<T extends FreeCourseCandidate>(candidates: T[], opts: { excludeIds: string[]; category: string | null; limit?: number }): T[] {
  const skip = new Set(opts.excludeIds);
  const cat = (opts.category ?? "").trim().toLowerCase();
  return candidates
    .filter((c) => !skip.has(c.id))
    .map((c) => ({ c, same: cat !== "" && (c.category ?? "").trim().toLowerCase() === cat ? 1 : 0 }))
    .sort((a, b) => b.same - a.same || b.c.enrolled - a.c.enrolled || a.c.title.localeCompare(b.c.title))
    .slice(0, opts.limit ?? 3)
    .map((x) => x.c);
}

/** The consent the person gave with a tick, as stored. The follow-up tick covers email and WhatsApp together. */
export function consentChannels(followUp: boolean): ("EMAIL" | "WHATSAPP")[] {
  return followUp ? ["EMAIL", "WHATSAPP"] : [];
}

export const FOLLOW_UP_NOTICE = "Contact me by email and WhatsApp about this course. I can stop at any time.";
export const NEWSLETTER_NOTICE = "Send me news and offers about other AAICBI courses.";
