/**
 * Ayakbi Arena growth funnel rules, as pure functions (no database).
 *
 * A course runs its public taster only when every layer allows it: the platform master switch, the AAICBI or
 * organization switch for who owns the course, the organization's own switch (with its agreement recorded), the
 * course's own opt-in, and the course being ready (module 1 questions, an assessment, an approved taster).
 */

export const TASTER_SIZE = 5;
/** A percentile is only shown once this many people have finished, so a small crowd never produces a made-up claim. */
export const MIN_PLAYS_FOR_PERCENT = 30;
export const SOURCE_MAX = 40;

export type GrowthScope = "PLATFORM" | "OWN" | "ORGS" | "ORGANIZATION";
export interface SwitchRow { enabled: boolean; agreementAt?: Date | string | null }

export interface LayerInput {
  platform: SwitchRow | null;
  own: SwitchRow | null;
  orgs: SwitchRow | null;
  /** The organization's own row, when the course belongs to an organization. */
  organization: SwitchRow | null;
  /** null for a course AAICBI published itself. */
  organizationId: string | null;
  campaignEnabled: boolean;
}

/** Why a course's link is not live because of the switches (empty when the switches allow it). */
export function switchBlockers(i: LayerInput): string[] {
  const out: string[] = [];
  if (!i.platform?.enabled) out.push("The platform master switch is off.");
  if (i.organizationId) {
    if (!i.orgs?.enabled) out.push("The organization courses switch is off.");
    if (!i.organization?.enabled) out.push("This organization's switch is off.");
    else if (!i.organization.agreementAt) out.push("The organization's agreement is not recorded.");
  } else if (!i.own?.enabled) out.push("The AAICBI courses switch is off.");
  if (!i.campaignEnabled) out.push("This course's own switch is off.");
  return out;
}

export interface ReadinessInput {
  published: boolean;
  hasModule: boolean;
  hasAssessment: boolean;
  usableQuestions: number;
  approvedTaster: number;
  /** How many of the approved taster questions are still usable (not deleted or changed). */
  approvedStillUsable: number;
}

/** What a course still needs before it can be switched on. */
export function readinessIssues(r: ReadinessInput): string[] {
  const out: string[] = [];
  if (!r.published) out.push("The course is not published.");
  if (!r.hasModule) out.push("The course has no module 1.");
  else {
    if (!r.hasAssessment) out.push("Module 1 has no assessment.");
    if (r.usableQuestions < TASTER_SIZE) out.push(`Module 1 needs at least ${TASTER_SIZE} approved practice questions and has ${r.usableQuestions}.`);
  }
  if (r.approvedTaster < TASTER_SIZE) out.push(`The instructor has approved ${r.approvedTaster} of ${TASTER_SIZE} taster questions.`);
  else if (r.approvedStillUsable < TASTER_SIZE) out.push("A taster question changed or was removed. The instructor needs to approve the taster again.");
  return out;
}

export interface Rank { key: "NEWCOMER" | "BRONZE" | "SILVER" | "GOLD"; label: string }

/** The rank a newcomer earns from a taster score, scaled to however many questions there were. */
export function tasterRank(score: number, total: number): Rank {
  const share = total > 0 ? score / total : 0;
  if (share >= 1) return { key: "GOLD", label: "Gold Automator" };
  if (share >= 0.8) return { key: "SILVER", label: "Silver Automator" };
  if (share >= 0.4) return { key: "BRONZE", label: "Bronze Automator" };
  return { key: "NEWCOMER", label: "Rising Newcomer" };
}

/** Share of finished plays this score beat or matched strictly lower than, or null when too few people have played to say. */
export function beatPercent(score: number, finishedScores: number[]): number | null {
  if (finishedScores.length < MIN_PLAYS_FOR_PERCENT) return null;
  const lower = finishedScores.filter((s) => s < score).length;
  return Math.round((lower / finishedScores.length) * 100);
}

/** Emoji answer grid that spoils nothing: one square per question. */
export function answerGrid(correct: boolean[]): string {
  return correct.map((c) => (c ? "🟩" : "🟥")).join("");
}

/** A URL-safe slug from a title, never empty. */
export function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  return s || "course";
}

/** A campaign slug is lowercase words joined by dashes. */
export function isCampaignSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 60;
}

/** Where a share link came from, cleaned so it can be stored and shown in a report. */
export function cleanSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, SOURCE_MAX);
  return s || null;
}

/** Commission is stored in basis points (1500 = 15%); the admin types a percentage with up to two decimals. */
export function percentToBps(percent: unknown): number | null {
  const n = typeof percent === "number" ? percent : typeof percent === "string" && percent.trim() !== "" ? Number(percent) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}
export const bpsToPercent = (bps: number | null | undefined): number | null => (bps == null ? null : bps / 100);

export const WHATSAPP_TEXT = (score: number, total: number, url: string) => `I got ${score}/${total} on this AI automation quiz. Can you beat me? 90 seconds, no signup: ${url}`;

// ---------------------------------------------------------------- saving a score

/** What the newcomer agrees to when they save their score. Stored with the lead. */
export const CONSENT_TEXT = "I agree to be contacted about this course on WhatsApp, SMS or email. I can stop at any time.";

/** A Nigerian or international phone number as E.164, or null when it does not look like one. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const plus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (plus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  const local = digits.startsWith("234") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (digits.startsWith("234") || digits.startsWith("0") || digits.length === 10) return /^[789]\d{9}$/.test(local) ? `+234${local}` : null;
  return null;
}

export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  return s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

export type LeadCheck = { ok: true; phone: string | null; email: string | null } | { ok: false; error: string };

/** A saved score needs consent and at least one way to reach the person. A given number or address must be valid. */
export function checkLead(input: { phone?: unknown; email?: unknown; consent?: unknown }): LeadCheck {
  if (input.consent !== true) return { ok: false, error: "Please tick the box to agree to be contacted." };
  const hasPhone = typeof input.phone === "string" && input.phone.trim() !== "";
  const hasEmail = typeof input.email === "string" && input.email.trim() !== "";
  if (!hasPhone && !hasEmail) return { ok: false, error: "Add a WhatsApp number or an email so we can save your score." };
  const phone = hasPhone ? normalizePhone(input.phone) : null;
  if (hasPhone && !phone) return { ok: false, error: "That phone number doesn't look right. Try it like 0803 000 0000." };
  const email = hasEmail ? cleanEmail(input.email) : null;
  if (hasEmail && !email) return { ok: false, error: "That email doesn't look right." };
  return { ok: true, phone, email };
}

// ---------------------------------------------------------------- module 1 access

/** How many modules are open without payment: the course's own free preview, or the funnel's module 1 for someone who came through it. */
export function effectivePreviewCount(coursePreviewCount: number | null | undefined, grantModules: number | null | undefined): number {
  return Math.max(coursePreviewCount ?? 0, grantModules ?? 0);
}

// ---------------------------------------------------------------- async duels and the result card

export const NICK_MAX = 20;
export const SHARE_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SHARE_CODE_LENGTH = 8;
export const isShareCode = (s: unknown): s is string => typeof s === "string" && s.length === SHARE_CODE_LENGTH && [...s].every((c) => SHARE_CODE_ALPHABET.includes(c));
/** Standings show this many players at most (the challenger and the friends who took the challenge). */
export const STANDINGS_MAX = 10;
/** Two plays on the same score are a tie unless one was this much faster. */
export const TIE_WINDOW_MS = 1000;

/** The name shown on a challenge: letters, numbers, spaces, apostrophes, hyphens and underscores only (so no links), 20 characters at most. */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[^\p{L}\p{N} '_-]+/gu, "").replace(/\s+/g, " ").trim().slice(0, NICK_MAX).trim();
  return s || null;
}
export const displayName = (nickname: string | null | undefined) => nickname || "A friend";

export interface DuelSide { score: number; durationMs: number | null }
export type DuelOutcome = "WIN" | "LOSE" | "TIE";

/** How `me` did against `other`: the higher score wins; on the same score the clearly faster run wins, otherwise it is a tie. */
export function duelOutcome(me: DuelSide, other: DuelSide): DuelOutcome {
  if (me.score !== other.score) return me.score > other.score ? "WIN" : "LOSE";
  if (me.durationMs == null || other.durationMs == null) return "TIE";
  const gap = other.durationMs - me.durationMs;
  if (Math.abs(gap) < TIE_WINDOW_MS) return "TIE";
  return gap > 0 ? "WIN" : "LOSE";
}

export interface StandingInput { id: string; nickname: string | null; score: number; durationMs: number | null }

/** Highest score first; on the same score the faster run first (a missing time counts as slowest); then by id so the order never flickers. */
export function rankStandings<T extends StandingInput>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.score - a.score || (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity) || a.id.localeCompare(b.id)).slice(0, STANDINGS_MAX);
}

export function duelHeadline(outcome: DuelOutcome, otherName: string): string {
  if (outcome === "WIN") return `You beat ${otherName}!`;
  if (outcome === "LOSE") return `${otherName} wins this one.`;
  return `It's a tie with ${otherName}.`;
}

export const duelPath = (slug: string, code: string) => `/play/${slug}?duel=${code}`;
export const challengeText = (name: string | null, score: number, total: number, url: string) => `${displayName(name) === "A friend" ? "I" : `${name} here. I`} got ${score}/${total} on this AI automation quiz. Can you beat me? Same 5 questions, 90 seconds, no signup: ${url}`;

export const CARD_SIZES = { og: { width: 1200, height: 630 }, status: { width: 1080, height: 1920 } } as const;
export type CardFormat = keyof typeof CARD_SIZES;
export const cardFormat = (raw: unknown): CardFormat => (raw === "status" ? "status" : "og");

// ---------------------------------------------------------------- squads

export const SQUAD_MAX_MEMBERS = 50;
export const SQUAD_NAME_MIN = 3;
export const SQUAD_NAME_MAX = 24;
/** The squad board lists this many members, best first. */
export const SQUAD_BOARD_MEMBERS = 10;
export const SQUAD_BOARD_RIVALS = 5;
/** One device can join the same squad this many times an hour, so a single phone cannot pad a squad's total. */
export const SQUAD_JOINS_PER_HOUR = 6;

/** A squad's name: same safe characters as a challenge name, 3 to 24 characters. */
export function cleanSquadName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[^\p{L}\p{N} '_-]+/gu, "").replace(/\s+/g, " ").trim().slice(0, SQUAD_NAME_MAX).trim();
  return s.length >= SQUAD_NAME_MIN ? s : null;
}

export interface SquadTotals { members: number; total: number; max: number; average: number }

/** A squad's score is the total of its members' scores out of everything they could have earned; the average is shown beside it. */
export function squadTotals(scores: number[], perPlay: number): SquadTotals {
  const total = scores.reduce((a, b) => a + b, 0);
  return { members: scores.length, total, max: scores.length * perPlay, average: scores.length ? Math.round((total / scores.length) * 10) / 10 : 0 };
}

export type SquadStanding = "AHEAD" | "BEHIND" | "LEVEL";
/** How a squad stands against another on total points. */
export function squadStanding(mine: number, theirs: number): SquadStanding {
  return mine === theirs ? "LEVEL" : mine > theirs ? "AHEAD" : "BEHIND";
}

export interface SquadRankInput { id: string; total: number; members: number }
/** Highest total first; on a tie the bigger squad first; then by id so the order never flickers. */
export function rankSquads<T extends SquadRankInput>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.total - a.total || b.members - a.members || a.id.localeCompare(b.id));
}

export const squadPath = (slug: string, code: string) => `/play/${slug}?squad=${code}`;
export const rivalPath = (slug: string, code: string) => `/play/${slug}?rival=${code}`;
export const squadJoinText = (squadName: string, url: string) => `Join ${squadName}! We're playing a 90-second AI automation quiz and every score counts for the squad. No signup: ${url}`;
export const squadRivalText = (squadName: string, url: string) => `${squadName} challenges your squad on an AI automation quiz. Start your squad, get your friends to play the same 5 questions, and see who wins. No signup: ${url}`;

// ---------------------------------------------------------------- scholarship seats

export const MAX_SCHOLARSHIP_SEATS = 1000;

/** Why scholarship seats cannot be given for a course right now, because of the switches (empty when they allow it). */
export function scholarshipBlockers(i: Omit<LayerInput, "campaignEnabled"> & { ownScholarships: boolean; organizationScholarships: boolean }): string[] {
  const out: string[] = [];
  if (!i.platform?.enabled) out.push("The platform master switch is off.");
  if (i.organizationId) {
    if (!i.orgs?.enabled) out.push("The organization courses switch is off.");
    if (!i.organization?.agreementAt) out.push("The organization's agreement is not recorded.");
    if (!i.organizationScholarships) out.push("Scholarship seats are off for this organization.");
  } else {
    if (!i.own?.enabled) out.push("The AAICBI courses switch is off.");
    if (!i.ownScholarships) out.push("Scholarship seats are off for AAICBI courses.");
  }
  return out;
}

/** Whole number in range, else null. */
export function cleanCount(v: unknown, max = MAX_SCHOLARSHIP_SEATS): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > max) return null;
  return n;
}

export interface SeatInput { seats: number; minPlays: number; finishedPlays: number; held: number }
export interface SeatState { open: boolean; left: number; reason: string | null }

/** Whether a new seat can be given: seats set, enough people have played, and some are still free. */
export function seatState(i: SeatInput): SeatState {
  const left = Math.max(0, i.seats - i.held);
  if (i.seats <= 0) return { open: false, left: 0, reason: "No seats are set for this course." };
  if (i.finishedPlays < i.minPlays) return { open: false, left, reason: `Opens after ${i.minPlays} people finish the taster (${i.finishedPlays} so far).` };
  if (left === 0) return { open: false, left: 0, reason: "All seats are taken." };
  return { open: true, left, reason: null };
}
