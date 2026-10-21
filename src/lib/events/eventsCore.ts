/**
 * The Event Manager's rules, with no database and no network, so every rule here is tested. Covers: what an event may contain, time zones,
 * the internal lifecycle and the separate public-promotion workflow, who may see an event and its joining details, and registration.
 *
 * Two ideas run through it:
 *  - `status` (the event's own life) and `promotionStatus` (whether AAICBI advertises it) are different things. An organisation can run
 *    a session even when its request for promotion is rejected.
 *  - Public information and joining credentials are different things. A card, a list or a public page never carries a meeting link.
 */

export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;

// ---------------------------------------------------------------------------------------------------------------- vocabulary

export const EVENT_TYPES = [
  { key: "LIVE_TRAINING", label: "Live training session" },
  { key: "ONLINE_CLASS", label: "Online class" },
  { key: "PHYSICAL_CLASS", label: "Physical class or workshop" },
  { key: "TRAINEE_MEETING", label: "Trainee meeting" },
  { key: "STAFF_MEETING", label: "Staff meeting" },
  { key: "MENTORING", label: "Mentoring session" },
  { key: "PRESENTATION", label: "Project presentation" },
  { key: "DEMONSTRATION", label: "Practical demonstration" },
  { key: "ASSESSMENT", label: "Assessment or revision session" },
  { key: "WEBINAR", label: "Webinar" },
  { key: "COMMUNITY", label: "Community event" },
  { key: "PUBLIC_LECTURE", label: "Public lecture" },
  { key: "CEREMONY", label: "Graduation or certificate ceremony" },
  { key: "COMPETITION", label: "Competition or hackathon" },
  { key: "OTHER", label: "Other activity" },
] as const;
export type EventTypeKey = (typeof EVENT_TYPES)[number]["key"];
export const EVENT_TYPE_KEYS: string[] = EVENT_TYPES.map((t) => t.key);
export const eventTypeLabel = (k: string) => EVENT_TYPES.find((t) => t.key === k)?.label ?? "Other activity";

export type Delivery = "PHYSICAL" | "ONLINE" | "HYBRID";
export const DELIVERIES: Delivery[] = ["PHYSICAL", "ONLINE", "HYBRID"];
export const DELIVERY_LABEL: Record<Delivery, string> = { PHYSICAL: "Physical", ONLINE: "Online", HYBRID: "Hybrid" };

export type Audience = "PUBLIC" | "ORG_MEMBERS" | "SELECTED_TRAINEES" | "ORG_STAFF" | "INVITED" | "PRIVATE";
export const AUDIENCES: Audience[] = ["PUBLIC", "ORG_MEMBERS", "SELECTED_TRAINEES", "ORG_STAFF", "INVITED", "PRIVATE"];
export const AUDIENCE_LABEL: Record<Audience, string> = {
  PUBLIC: "Public: the whole AAICBI Ecosystem",
  ORG_MEMBERS: "Organisation members",
  SELECTED_TRAINEES: "Selected trainees, courses or cohorts",
  ORG_STAFF: "Organisation staff only",
  INVITED: "Invited participants only",
  PRIVATE: "Private or internal",
};
export const AUDIENCE_SHORT: Record<Audience, string> = { PUBLIC: "Public", ORG_MEMBERS: "Members", SELECTED_TRAINEES: "Selected trainees", ORG_STAFF: "Staff", INVITED: "Invited", PRIVATE: "Private" };

export type Status = "DRAFT" | "SCHEDULED" | "CANCELLED" | "ARCHIVED";
export type Promotion = "NONE" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED" | "PUBLISHED" | "REJECTED";
export type RegistrationMode = "OPEN" | "REGISTRATION" | "APPROVAL" | "INVITE_ONLY";
export const REGISTRATION_MODES: RegistrationMode[] = ["OPEN", "REGISTRATION", "APPROVAL", "INVITE_ONLY"];
export const REGISTRATION_MODE_LABEL: Record<RegistrationMode, string> = {
  OPEN: "Open attendance (no registration)",
  REGISTRATION: "Registration required",
  APPROVAL: "Registration needs approval",
  INVITE_ONLY: "Invited participants only",
};
export type RegistrationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "DECLINED";
export const TARGET_KINDS = ["COHORT", "COURSE", "TRAINEE", "PROFILE"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** What the organiser and the viewer see, worked out from the stored fields and the clock. */
export type Phase = "DRAFT" | "UPCOMING" | "LIVE" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
export const PHASE_LABEL: Record<Phase, string> = { DRAFT: "Draft", UPCOMING: "Scheduled", LIVE: "Live now", COMPLETED: "Completed", CANCELLED: "Cancelled", ARCHIVED: "Archived" };
export const PROMOTION_LABEL: Record<Promotion, string> = {
  NONE: "Not promoted", SUBMITTED: "Submitted for review", CHANGES_REQUESTED: "Changes requested", APPROVED: "Approved for promotion", PUBLISHED: "Published", REJECTED: "Rejected",
};

export interface PhaseInput { status: Status; startsAt: Date; endsAt: Date }
export function phaseOf(e: PhaseInput, now: Date = new Date()): Phase {
  if (e.status === "DRAFT") return "DRAFT";
  if (e.status === "CANCELLED") return "CANCELLED";
  if (e.status === "ARCHIVED") return "ARCHIVED";
  if (now.getTime() < e.startsAt.getTime()) return "UPCOMING";
  if (now.getTime() < e.endsAt.getTime()) return "LIVE";
  return "COMPLETED";
}

// ---------------------------------------------------------------------------------------------------------------- text helpers

// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** One line of plain text: control characters out, white space collapsed. */
export const oneLine = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(CTRL, "").replace(/\s+/g, " ").trim().slice(0, max + 1) : "");
/** Several lines of plain text (paragraphs kept). Never HTML: it is always rendered as text. */
export const multiLine = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(CTRL, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max + 1) : "");

// ---------------------------------------------------------------------------------------------------------------- links and media

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
function isIpHost(h: string): boolean { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || /^\[.*\]$/.test(h); }

/** A plain https address with no login in it, on a real public-looking host. Used for meeting, map, registration and video links. */
export function checkHttpsUrl(raw: unknown, what = "link"): { ok: true; url: string; host: string } | { ok: false; error: string } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: false, error: `Add the ${what}.` };
  if (s.length > 500) return { ok: false, error: `That ${what} is too long.` };
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, error: `That does not look like a web address.` }; }
  if (u.protocol !== "https:") return { ok: false, error: `The ${what} must start with https://` };
  if (u.username || u.password) return { ok: false, error: `The ${what} must not contain a login.` };
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || PRIVATE_HOST.test(host) || isIpHost(host)) return { ok: false, error: `That does not look like a public web address.` };
  return { ok: true, url: u.toString(), host };
}

export const PROVIDERS: { name: string; match: RegExp }[] = [
  { name: "Google Meet", match: /(^|\.)meet\.google\.com$/ },
  { name: "Zoom", match: /(^|\.)zoom\.us$|(^|\.)zoom\.com$|(^|\.)zoomgov\.com$/ },
  { name: "Microsoft Teams", match: /(^|\.)teams\.microsoft\.com$|(^|\.)teams\.live\.com$/ },
  { name: "Webex", match: /(^|\.)webex\.com$/ },
  { name: "Jitsi Meet", match: /(^|\.)meet\.jit\.si$/ },
  { name: "Whereby", match: /(^|\.)whereby\.com$/ },
  { name: "GoTo Meeting", match: /(^|\.)gotomeeting\.com$|(^|\.)goto\.com$/ },
  { name: "Skype", match: /(^|\.)join\.skype\.com$/ },
];
/** The conferencing service a link belongs to, or "Other video service". */
export function detectProvider(host: string): string {
  const h = host.toLowerCase();
  return PROVIDERS.find((p) => p.match.test(h))?.name ?? "Other video service";
}

/** A file this app stored itself (never a link to somewhere else). */
export function isBlobUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try { const u = new URL(url); return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com"); } catch { return false; }
}

export const MEDIA_RULES = {
  FLYER: { types: ["image/jpeg", "image/png", "image/webp"], maxBytes: 5 * 1024 * 1024, label: "image (JPG, PNG or WebP, up to 5 MB)" },
  IMAGE: { types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 5 * 1024 * 1024, label: "image (JPG, PNG, WebP or GIF, up to 5 MB)" },
  VIDEO: { types: ["video/mp4", "video/webm"], maxBytes: 30 * 1024 * 1024, label: "video (MP4 or WebM, up to 30 MB)" },
} as const;
export type MediaKind = keyof typeof MEDIA_RULES;
export const mediaPrefix = (k: "flyer" | "image" | "video") => `events/${k}/`;
export const MAX_EXTRA_MEDIA = 8;

/** A YouTube or Vimeo address, turned into the address of the player that is safe to put in a frame. */
export function embedFor(raw: string): { provider: "YouTube" | "Vimeo"; embedUrl: string } | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase().replace(/^www\./, "");
  if (h === "youtu.be") { const id = u.pathname.slice(1).split("/")[0]; return /^[\w-]{6,20}$/.test(id) ? { provider: "YouTube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null; }
  if (h === "youtube.com" || h === "m.youtube.com") {
    const id = u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(embed|shorts|live)\/([\w-]{6,20})/.exec(u.pathname)?.[2];
    return id && /^[\w-]{6,20}$/.test(id) ? { provider: "YouTube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (h === "vimeo.com") { const id = /^\/(\d{5,12})/.exec(u.pathname)?.[1]; return id ? { provider: "Vimeo", embedUrl: `https://player.vimeo.com/video/${id}` } : null; }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------- time zones

export const DEFAULT_ZONE = "Africa/Lagos";
export const COMMON_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo", "Europe/London", "UTC", "America/New_York", "Asia/Dubai"];

export function validZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 60) return false;
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return true; } catch { return false; }
}

function offsetMinutes(utcMs: number, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / MINUTE_MS);
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
/** "2027-01-12T10:00" read as wall-clock time in the zone, as a moment. Null if it is not a real date and time. */
export function zonedToUtc(local: unknown, tz: string): Date | null {
  if (typeof local !== "string" || !validZone(tz)) return null;
  const m = LOCAL.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  let t = guess - offsetMinutes(guess, tz) * MINUTE_MS;
  t = guess - offsetMinutes(t, tz) * MINUTE_MS;
  return new Date(t);
}

/** A moment as "YYYY-MM-DDTHH:mm" wall-clock time in the zone: what the form's date and time boxes hold. */
export function utcToLocalInput(d: Date, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

const ZONE_NAMES: Record<string, string> = { "Africa/Lagos": "WAT", "Africa/Accra": "GMT", "Africa/Nairobi": "EAT", "Africa/Johannesburg": "SAST", "Africa/Cairo": "EET", "UTC": "UTC" };
/** A short label for the zone, always shown beside a time ("WAT", "GMT+1"). */
export function zoneLabel(tz: string, at: Date): string {
  if (ZONE_NAMES[tz]) return ZONE_NAMES[tz];
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((x) => x.type === "timeZoneName")?.value ?? tz; } catch { return tz; }
}

/** "Tue 12 Jan 2027, 10:00 to 12:00 WAT". Always in the event's own zone, always with the zone named. */
export function formatWhen(start: Date, end: Date, tz: string): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);
  const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const z = zoneLabel(tz, start);
  return day(start) === day(end) ? `${day(start)}, ${time(start)} to ${time(end)} ${z}` : `${day(start)}, ${time(start)} to ${day(end)}, ${time(end)} ${z}`;
}
export function formatDay(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(d);
}
/** "YYYY-MM-DD" of the moment in the zone, to group events by day. */
export const dayKey = (d: Date, tz: string): string => utcToLocalInput(d, tz).slice(0, 10);

export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

// ---------------------------------------------------------------------------------------------------------------- input and validation

export const LIMITS = { title: 120, summary: 280, description: 8000, venue: 160, address: 240, city: 80, directions: 2000, notes: 1000, meetingId: 100, passcode: 100, instructions: 2000, minTitle: 3, maxDays: 14, maxCapacity: 100_000, maxTargets: 200 };

export interface TargetInput { kind: TargetKind; refId: string }
export interface EventValue {
  title: string; summary: string | null; description: string | null; categoryId: string | null; eventType: string;
  startsAt: Date; endsAt: Date; timeZone: string; registrationDeadline: Date | null; capacity: number | null;
  delivery: Delivery; venueName: string | null; address: string | null; city: string | null; state: string | null; directions: string | null; mapUrl: string | null; attendanceNotes: string | null;
  conferenceProvider: string | null;
  join: { meetingUrl: string; meetingId: string | null; passcode: string | null; instructions: string | null } | null;
  audience: Audience; targets: TargetInput[];
  registrationMode: RegistrationMode; registrationNotes: string | null; registrationUrl: string | null; hybridSeparateRegistration: boolean;
  flyerUrl: string | null; videoUrl: string | null; videoKind: "UPLOAD" | "EXTERNAL" | null;
  media: { kind: "POSTER" | "IMAGE" | "VIDEO"; url: string; mimeType: string | null; sizeBytes: number | null; caption: string | null }[];
  joinOpensMinutes: number | null;
}
export type FieldErrors = Record<string, string>;
export interface Validation { ok: boolean; errors: FieldErrors; warnings: string[]; value?: EventValue }

const opt = (s: string, max: number) => (s ? s.slice(0, max) : null);

/**
 * Checks everything the server will accept. `mode: "draft"` is forgiving (only what is needed to save a title and not lose work);
 * `mode: "schedule"` is strict (the event must be complete and not already over). The client runs the same function for instant messages,
 * but the server is the authority.
 */
export function validateEvent(raw: unknown, mode: "draft" | "schedule", now: Date = new Date()): Validation {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  const strict = mode === "schedule";

  const title = oneLine(r.title, LIMITS.title);
  if (title.length < LIMITS.minTitle) errors.title = `Give the event a title of at least ${LIMITS.minTitle} characters.`;
  else if (title.length > LIMITS.title) errors.title = `Keep the title to ${LIMITS.title} characters.`;
  const summary = oneLine(r.summary, LIMITS.summary);
  if (summary.length > LIMITS.summary) errors.summary = `Keep the summary to ${LIMITS.summary} characters.`;
  const description = multiLine(r.description, LIMITS.description);
  if (description.length > LIMITS.description) errors.description = `Keep the description to ${LIMITS.description} characters.`;
  if (strict && !summary && !description) errors.summary = "Add a short summary so people know what the event is.";

  const eventType = typeof r.eventType === "string" && EVENT_TYPE_KEYS.includes(r.eventType) ? r.eventType : "OTHER";
  const categoryId = typeof r.categoryId === "string" && r.categoryId.length <= 60 && r.categoryId ? r.categoryId : null;

  const timeZone = r.timeZone === undefined || r.timeZone === "" ? DEFAULT_ZONE : r.timeZone;
  let zone = DEFAULT_ZONE;
  if (!validZone(timeZone)) errors.timeZone = "Choose a valid time zone.";
  else zone = timeZone;

  const startsAt = zonedToUtc(r.startLocal, zone);
  const endsAt = zonedToUtc(r.endLocal, zone);
  if (!startsAt) errors.startLocal = "Choose a start date and time.";
  if (!endsAt) errors.endLocal = "Choose an end date and time.";
  if (startsAt && endsAt) {
    if (endsAt.getTime() <= startsAt.getTime()) errors.endLocal = "The event must end after it starts.";
    else if (endsAt.getTime() - startsAt.getTime() > LIMITS.maxDays * DAY_MS) errors.endLocal = `An event can last at most ${LIMITS.maxDays} days. Create separate events for a longer programme.`;
    else if (endsAt.getTime() <= now.getTime()) {
      if (strict) errors.endLocal = "That event is already over. Choose a future date, or keep it as a draft.";
      else warnings.push("This event is in the past.");
    } else if (startsAt.getTime() < now.getTime()) warnings.push("The start time has already passed; the event will show as live.");
  }

  let registrationDeadline: Date | null = null;
  if (r.registrationDeadlineLocal) {
    registrationDeadline = zonedToUtc(r.registrationDeadlineLocal, zone);
    if (!registrationDeadline) errors.registrationDeadlineLocal = "That is not a valid deadline.";
    else if (endsAt && registrationDeadline.getTime() > endsAt.getTime()) errors.registrationDeadlineLocal = "The registration deadline must be before the event ends.";
  }
  let capacity: number | null = null;
  if (r.capacity !== undefined && r.capacity !== null && r.capacity !== "") {
    const n = Number(r.capacity);
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.maxCapacity) errors.capacity = `Capacity must be a whole number from 1 to ${LIMITS.maxCapacity}.`;
    else capacity = n;
  }

  const delivery: Delivery = DELIVERIES.includes(r.delivery as Delivery) ? (r.delivery as Delivery) : "PHYSICAL";
  const physical = delivery !== "ONLINE";
  const online = delivery !== "PHYSICAL";

  const venueName = oneLine(r.venueName, LIMITS.venue), address = oneLine(r.address, LIMITS.address), city = oneLine(r.city, LIMITS.city), state = oneLine(r.state, LIMITS.city);
  const directions = multiLine(r.directions, LIMITS.directions), attendanceNotes = multiLine(r.attendanceNotes, LIMITS.notes);
  if (venueName.length > LIMITS.venue) errors.venueName = `Keep the venue name to ${LIMITS.venue} characters.`;
  if (address.length > LIMITS.address) errors.address = `Keep the address to ${LIMITS.address} characters.`;
  if (physical && strict) {
    if (!venueName) errors.venueName = "Name the venue.";
    if (!address && !city) errors.address = "Add the street address or the city.";
  }
  let mapUrl: string | null = null;
  if (physical && oneLine(r.mapUrl, 500)) {
    const c = checkHttpsUrl(r.mapUrl, "map link");
    if (c.ok) mapUrl = c.url; else errors.mapUrl = c.error;
  }

  let join: EventValue["join"] = null;
  let conferenceProvider: string | null = null;
  if (online) {
    const urlRaw = typeof r.meetingUrl === "string" ? r.meetingUrl.trim() : "";
    if (!urlRaw) {
      if (strict) errors.meetingUrl = "Add the meeting link people will use to join.";
    } else {
      const c = checkHttpsUrl(urlRaw, "meeting link");
      if (!c.ok) errors.meetingUrl = c.error;
      else {
        conferenceProvider = detectProvider(c.host);
        const meetingId = oneLine(r.meetingId, LIMITS.meetingId), passcode = oneLine(r.passcode, LIMITS.passcode), instructions = multiLine(r.joinInstructions, LIMITS.instructions);
        if (meetingId.length > LIMITS.meetingId) errors.meetingId = `Keep the meeting ID to ${LIMITS.meetingId} characters.`;
        if (passcode.length > LIMITS.passcode) errors.passcode = `Keep the passcode to ${LIMITS.passcode} characters.`;
        if (instructions.length > LIMITS.instructions) errors.joinInstructions = `Keep the joining instructions to ${LIMITS.instructions} characters.`;
        join = { meetingUrl: c.url, meetingId: opt(meetingId, LIMITS.meetingId), passcode: opt(passcode, LIMITS.passcode), instructions: opt(instructions, LIMITS.instructions) };
      }
    }
  }

  const audience: Audience = AUDIENCES.includes(r.audience as Audience) ? (r.audience as Audience) : "PRIVATE";
  const targets: TargetInput[] = [];
  if (Array.isArray(r.targets)) {
    const seen = new Set<string>();
    for (const t of r.targets.slice(0, LIMITS.maxTargets)) {
      const k = (t as { kind?: unknown })?.kind, id = (t as { refId?: unknown })?.refId;
      if (typeof k !== "string" || !(TARGET_KINDS as readonly string[]).includes(k) || typeof id !== "string" || !id || id.length > 60) continue;
      const key = `${k}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ kind: k as TargetKind, refId: id });
    }
  }
  if (strict && (audience === "SELECTED_TRAINEES" || audience === "INVITED") && targets.length === 0) {
    errors.targets = audience === "INVITED" ? "Choose who to invite." : "Choose at least one cohort, course or trainee.";
  }

  const registrationMode: RegistrationMode = REGISTRATION_MODES.includes(r.registrationMode as RegistrationMode) ? (r.registrationMode as RegistrationMode) : "OPEN";
  if (strict && registrationMode === "INVITE_ONLY" && audience === "PUBLIC") errors.registrationMode = "A public event cannot be restricted to invited participants. Choose registration with approval instead.";
  const registrationNotes = multiLine(r.registrationNotes, LIMITS.notes);
  let registrationUrl: string | null = null;
  if (oneLine(r.registrationUrl, 500)) {
    const c = checkHttpsUrl(r.registrationUrl, "registration link");
    if (c.ok) registrationUrl = c.url; else errors.registrationUrl = c.error;
  }

  let flyerUrl: string | null = null;
  if (r.flyerUrl) { if (isBlobUrl(r.flyerUrl)) flyerUrl = r.flyerUrl; else errors.flyerUrl = "That picture was not stored by this app. Upload it again."; }
  let videoUrl: string | null = null;
  let videoKind: "UPLOAD" | "EXTERNAL" | null = null;
  if (r.videoUrl) {
    if (isBlobUrl(r.videoUrl)) { videoUrl = r.videoUrl; videoKind = "UPLOAD"; }
    else if (typeof r.videoUrl === "string" && embedFor(r.videoUrl)) { videoUrl = r.videoUrl.trim(); videoKind = "EXTERNAL"; }
    else errors.videoUrl = "Upload a video, or paste a YouTube or Vimeo link.";
  }

  const media: EventValue["media"] = [];
  if (Array.isArray(r.media)) {
    for (const m of r.media.slice(0, MAX_EXTRA_MEDIA)) {
      const o = (m ?? {}) as Record<string, unknown>;
      const kind = o.kind === "POSTER" || o.kind === "IMAGE" || o.kind === "VIDEO" ? o.kind : null;
      if (!kind || !isBlobUrl(o.url)) { errors.media = "One of the extra files was not stored by this app. Upload it again."; continue; }
      const rules = MEDIA_RULES[kind === "VIDEO" ? "VIDEO" : "IMAGE"];
      const mime = typeof o.mimeType === "string" ? o.mimeType.toLowerCase() : null;
      const size = typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes) ? Math.floor(o.sizeBytes) : null;
      if ((mime && !(rules.types as readonly string[]).includes(mime)) || (size !== null && size > rules.maxBytes)) { errors.media = `Extra files must be an ${rules.label}.`; continue; }
      media.push({ kind, url: o.url, mimeType: mime, sizeBytes: size, caption: opt(oneLine(o.caption, 140), 140) });
    }
  }

  let joinOpensMinutes: number | null = null;
  if (r.joinOpensMinutes !== undefined && r.joinOpensMinutes !== null && r.joinOpensMinutes !== "") {
    const n = Number(r.joinOpensMinutes);
    if (!Number.isInteger(n) || n < 0 || n > 1440) errors.joinOpensMinutes = "Choose from 0 to 1440 minutes before the start.";
    else joinOpensMinutes = n;
  }

  const ok = Object.keys(errors).length === 0 && !!startsAt && !!endsAt;
  if (!ok) return { ok: false, errors, warnings };
  return {
    ok: true, errors, warnings,
    value: {
      title, summary: opt(summary, LIMITS.summary), description: opt(description, LIMITS.description), categoryId, eventType,
      startsAt: startsAt as Date, endsAt: endsAt as Date, timeZone: zone, registrationDeadline, capacity,
      delivery, venueName: physical ? opt(venueName, LIMITS.venue) : null, address: physical ? opt(address, LIMITS.address) : null, city: physical ? opt(city, LIMITS.city) : null,
      state: physical ? opt(state, LIMITS.city) : null, directions: physical ? opt(directions, LIMITS.directions) : null, mapUrl, attendanceNotes: opt(attendanceNotes, LIMITS.notes),
      conferenceProvider: online ? conferenceProvider : null, join: online ? join : null,
      audience, targets, registrationMode, registrationNotes: opt(registrationNotes, LIMITS.notes), registrationUrl, hybridSeparateRegistration: delivery === "HYBRID" && r.hybridSeparateRegistration === true,
      flyerUrl, videoUrl, videoKind, media, joinOpensMinutes,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------- lifecycle

/** Which internal status changes are allowed. Draft → scheduled needs full validation; completed events can only be archived. */
export function canChangeStatus(from: Status, to: Status, phase: Phase): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: "Nothing to change." };
  if (to === "SCHEDULED") return from === "DRAFT" ? { ok: true } : { ok: false, reason: "Only a draft can be scheduled." };
  if (to === "CANCELLED") {
    if (from !== "SCHEDULED") return { ok: false, reason: "Only a scheduled event can be cancelled." };
    return phase === "COMPLETED" ? { ok: false, reason: "That event has already finished." } : { ok: true };
  }
  if (to === "ARCHIVED") return from === "ARCHIVED" ? { ok: false, reason: "Already archived." } : from === "DRAFT" ? { ok: false, reason: "Delete a draft instead of archiving it." } : from === "SCHEDULED" && phase !== "COMPLETED" ? { ok: false, reason: "Cancel the event first, or wait until it has finished." } : { ok: true };
  if (to === "DRAFT") return { ok: false, reason: "A scheduled event cannot go back to draft. Cancel it instead." };
  return { ok: false, reason: "That change is not allowed." };
}

export type PromotionAction = "submit" | "withdraw" | "approve" | "reject" | "request_changes" | "publish" | "unpublish";
export const PROMOTION_ACTIONS_NEED_REASON: PromotionAction[] = ["reject", "request_changes"];
const PROMOTION_FROM: Record<PromotionAction, Promotion[]> = {
  submit: ["NONE", "CHANGES_REQUESTED", "REJECTED"],
  withdraw: ["SUBMITTED", "CHANGES_REQUESTED"],
  approve: ["SUBMITTED"],
  reject: ["SUBMITTED", "APPROVED"],
  request_changes: ["SUBMITTED", "APPROVED", "PUBLISHED"],
  publish: ["APPROVED"],
  unpublish: ["PUBLISHED"],
};
const PROMOTION_TO: Record<PromotionAction, Promotion> = { submit: "SUBMITTED", withdraw: "NONE", approve: "APPROVED", reject: "REJECTED", request_changes: "CHANGES_REQUESTED", publish: "PUBLISHED", unpublish: "APPROVED" };

export function nextPromotion(from: Promotion, action: PromotionAction): { ok: true; to: Promotion } | { ok: false; reason: string } {
  if (!PROMOTION_FROM[action].includes(from)) return { ok: false, reason: "That is not possible at this stage of the request." };
  return { ok: true, to: PROMOTION_TO[action] };
}
/** Actions the organisation may take on its own request. Everything else belongs to the Super Admin or staff holding the permission. */
export const ORG_PROMOTION_ACTIONS: PromotionAction[] = ["submit", "withdraw"];

/** An organisation's promotional wording and pictures: changing them after approval sends the request back for review. */
export const PROMO_FIELDS = ["title", "summary", "description", "categoryId", "eventType", "flyerUrl", "videoUrl", "media"] as const;
export function changesPromo(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return PROMO_FIELDS.some((f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null));
}

export interface PublicInput { status: Status; audience: Audience; promotionStatus: Promotion; publishAt: Date | null; trainingOrganizationId: string | null; startsAt: Date; endsAt: Date }
/**
 * True when anyone may see the event: scheduled, meant for the public, and published. An organisation's event is published only after the
 * Super Admin approved and published it; AAICBI's own public event is published by staff holding the publish permission. A "publish at"
 * date in the future keeps an approved event hidden until that moment.
 */
export function isPublished(e: Pick<PublicInput, "status" | "audience" | "promotionStatus" | "publishAt">, now: Date = new Date()): boolean {
  if (e.status !== "SCHEDULED" || e.audience !== "PUBLIC") return false;
  if (e.promotionStatus === "PUBLISHED") return true;
  return e.promotionStatus === "APPROVED" && !!e.publishAt && e.publishAt.getTime() <= now.getTime();
}

/** The label an organisation sees for its public-promotion request. */
export function promotionLabel(e: Pick<PublicInput, "status" | "audience" | "promotionStatus" | "publishAt">, now: Date = new Date()): string {
  if (e.promotionStatus === "APPROVED" && e.publishAt) return e.publishAt.getTime() <= now.getTime() ? "Published" : "Scheduled for publication";
  return PROMOTION_LABEL[e.promotionStatus];
}

// ---------------------------------------------------------------------------------------------------------------- visibility

export interface Viewer {
  /** Anonymous (not signed in) when null. */
  profileId: string | null;
  traineeId: string | null;
  /** A training organisation's own session, or one of its teammates. */
  staffOrgId: string | null;
  /** Organisations a trainee belongs to (through their courses). */
  memberOrgIds: string[];
  cohortIds: string[];
  courseIds: string[];
  /** Holds the permission to see every event (a Super Admin, or staff with events.global:view). */
  seesAll: boolean;
  /** Any signed-in account at all. */
  signedIn: boolean;
}
export const ANON: Viewer = { profileId: null, traineeId: null, staffOrgId: null, memberOrgIds: [], cohortIds: [], courseIds: [], seesAll: false, signedIn: false };

export interface ViewableEvent extends PublicInput {
  id: string;
  targets: TargetInput[];
  registrationMode: RegistrationMode;
}

const hasTarget = (e: ViewableEvent, v: Viewer): boolean =>
  e.targets.some((t) =>
    (t.kind === "COHORT" && v.cohortIds.includes(t.refId)) ||
    (t.kind === "COURSE" && v.courseIds.includes(t.refId)) ||
    (t.kind === "TRAINEE" && !!v.traineeId && v.traineeId === t.refId) ||
    (t.kind === "PROFILE" && !!v.profileId && v.profileId === t.refId));

/** Does this viewer belong to the organisation that owns the event (or to any organisation, for AAICBI's own events)? */
const isStaffOfOwner = (e: ViewableEvent, v: Viewer): boolean => !!v.staffOrgId && (e.trainingOrganizationId === null || e.trainingOrganizationId === v.staffOrgId);
const isMemberOfOwner = (e: ViewableEvent, v: Viewer): boolean => (e.trainingOrganizationId === null ? v.memberOrgIds.length > 0 : v.memberOrgIds.includes(e.trainingOrganizationId));

/**
 * Who may see an event at all (its public information, not its joining details). Enforced on the server for every query; the same function
 * is used to filter lists. Drafts are for managers only. A cancelled event stays visible to the people it concerned so they learn of it.
 */
export function canView(e: ViewableEvent, v: Viewer, now: Date = new Date()): boolean {
  if (v.seesAll) return true;
  if (e.status === "ARCHIVED") return false;
  const owner = e.trainingOrganizationId !== null && v.staffOrgId === e.trainingOrganizationId;
  if (owner) return true;
  if (e.status === "DRAFT") return false;
  switch (e.audience) {
    case "PUBLIC":
      if (e.status === "CANCELLED") return (e.promotionStatus === "PUBLISHED" || e.promotionStatus === "APPROVED") && v.signedIn;
      if (isPublished(e, now)) return true;
      // Not published yet: it is still an internal event for the organisation's own people.
      return e.trainingOrganizationId !== null && (isMemberOfOwner(e, v) || hasTarget(e, v));
    case "ORG_MEMBERS": return isMemberOfOwner(e, v) || isStaffOfOwner(e, v) || hasTarget(e, v);
    case "SELECTED_TRAINEES": return hasTarget(e, v);
    case "ORG_STAFF": return isStaffOfOwner(e, v);
    case "INVITED": return hasTarget(e, v);
    case "PRIVATE": return hasTarget(e, v);
  }
}

export interface Registration { status: RegistrationStatus }

export interface JoinDecision { allowed: boolean; reason: string | null; opensAt: Date | null; available: boolean }
/**
 * Whether this viewer may be given the joining details (link, ID, passcode) right now. The details are never part of the event's public
 * information. Managers may always see them; everyone else must be able to view the event, be signed in, hold a confirmed registration when
 * the event asks for one, and the window must be open. Visiting the link is never recorded as attendance.
 */
export function joinDecision(e: ViewableEvent & { delivery: Delivery; joinOpensMinutes: number | null }, v: Viewer, reg: Registration | null, manager: boolean, defaultOpenMinutes: number, now: Date = new Date()): JoinDecision {
  const no = (reason: string, opensAt: Date | null = null): JoinDecision => ({ allowed: false, reason, opensAt, available: false });
  if (e.delivery === "PHYSICAL") return no("This is a physical event.");
  if (e.status !== "SCHEDULED") return no(e.status === "CANCELLED" ? "This event was cancelled." : "This event is not open.");
  if (manager) return { allowed: true, reason: null, opensAt: null, available: true };
  if (!v.signedIn) return no("Sign in to see how to join.");
  if (!canView(e, v, now)) return no("You do not have access to this event.");
  if (e.registrationMode !== "OPEN" && reg?.status !== "CONFIRMED") {
    const invited = e.registrationMode === "INVITE_ONLY" && e.audience !== "PUBLIC" && hasTarget(e, v);
    if (!invited) return no(reg?.status === "PENDING" ? "Your registration is waiting for approval." : "Register to get the joining details.");
  }
  const opens = new Date(e.startsAt.getTime() - (e.joinOpensMinutes ?? defaultOpenMinutes) * MINUTE_MS);
  if (now.getTime() < opens.getTime()) return no("The joining details appear shortly before the start.", opens);
  if (now.getTime() >= e.endsAt.getTime()) return no("This event has finished.");
  return { allowed: true, reason: null, opensAt: opens, available: true };
}

export interface RegistrationDecision { ok: boolean; reason?: string; status?: RegistrationStatus }
/** Whether a person may register now, and what their registration starts as. */
export function registrationDecision(
  e: ViewableEvent & { capacity: number | null; registrationDeadline: Date | null; registrationUrl: string | null },
  v: Viewer, existing: Registration | null, confirmedCount: number, registrationOn: boolean, now: Date = new Date(),
): RegistrationDecision {
  if (!registrationOn) return { ok: false, reason: "Registration is switched off." };
  if (!v.signedIn || !v.profileId) return { ok: false, reason: "Sign in to register." };
  if (e.status !== "SCHEDULED") return { ok: false, reason: e.status === "CANCELLED" ? "This event was cancelled." : "This event is not open for registration." };
  if (e.registrationMode === "OPEN") return { ok: false, reason: "This event does not need registration." };
  if (!canView(e, v, now)) return { ok: false, reason: "You do not have access to this event." };
  if (e.registrationMode === "INVITE_ONLY" && !hasTarget(e, v)) return { ok: false, reason: "This event is for invited participants only." };
  if (now.getTime() >= e.endsAt.getTime()) return { ok: false, reason: "This event has finished." };
  if (e.registrationDeadline && now.getTime() > e.registrationDeadline.getTime()) return { ok: false, reason: "The registration deadline has passed." };
  if (existing && (existing.status === "CONFIRMED" || existing.status === "PENDING")) return { ok: false, reason: "You are already registered." };
  if (existing?.status === "DECLINED") return { ok: false, reason: "The organiser declined your registration." };
  if (e.registrationMode === "APPROVAL") return { ok: true, status: "PENDING" };
  if (e.capacity !== null && confirmedCount >= e.capacity) return { ok: false, reason: "This event is full." };
  return { ok: true, status: "CONFIRMED" };
}
/** Whether the organiser may confirm one more registration. */
export const hasRoom = (capacity: number | null, confirmedCount: number): boolean => capacity === null || confirmedCount < capacity;

// ---------------------------------------------------------------------------------------------------------------- reminders

export const REMINDERS = [{ kind: "REMINDER_DAY", beforeMs: DAY_MS, label: "tomorrow" }, { kind: "REMINDER_HOUR", beforeMs: 60 * MINUTE_MS, label: "in about an hour" }] as const;
/** Which reminder is due now: the event starts within the window and the reminder has not been sent. The cron runs hourly, so each window is a little wider than its target. */
export function dueReminder(startsAt: Date, now: Date, sent: ReadonlySet<string>): (typeof REMINDERS)[number] | null {
  const until = startsAt.getTime() - now.getTime();
  if (until <= 0) return null;
  if (until <= 90 * MINUTE_MS && !sent.has("REMINDER_HOUR")) return REMINDERS[1];
  if (until <= DAY_MS + 30 * MINUTE_MS && until > 90 * MINUTE_MS && !sent.has("REMINDER_DAY")) return REMINDERS[0];
  return null;
}

// ---------------------------------------------------------------------------------------------------------------- calendar

export interface CalendarCell { key: string; inMonth: boolean }
/** The weeks of a month (Monday first), as "YYYY-MM-DD" keys. */
export function monthGrid(year: number, month0: number): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = Date.UTC(year, month0, 1 - lead);
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) { const t = new Date(start + (w * 7 + d) * DAY_MS); row.push({ key: t.toISOString().slice(0, 10), inMonth: t.getUTCMonth() === month0 }); }
    weeks.push(row);
    if (w >= 3 && weeks[w][6].key >= new Date(Date.UTC(year, month0 + 1, 0)).toISOString().slice(0, 10)) break;
  }
  return weeks;
}
export function weekDays(anchor: string): string[] {
  const t = new Date(`${anchor}T00:00:00Z`).getTime();
  const lead = (new Date(t).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(t - lead * DAY_MS + i * DAY_MS).toISOString().slice(0, 10));
}
