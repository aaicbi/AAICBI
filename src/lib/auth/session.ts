/**
 * Unified session handling for all four AAICBI LMS roles — a signed JWT
 * in an httpOnly cookie, with a `role` claim.
 *
 * This is the generalized version of the CBT scaffold's admin-only
 * session file, which explicitly documented itself as the extension
 * point for exactly this change: "If you add student accounts later,
 * this is the file to extend — put the same pattern behind /api/auth/*
 * with a `role` claim." That's what happened here.
 *
 * One cookie, one payload shape, four possible roles. Staff accounts
 * (SUPER_ADMIN/ADMIN/INSTRUCTOR) map to the `User` model; TRAINEE maps
 * to the `Trainee` model — two tables, one session mechanism.
 *
 * The correct-answer leak rule does NOT depend on this file — that's
 * enforced separately by never selecting `isCorrect`/explanation in any
 * query that serves an in-progress attempt. See src/lib/examEngine.ts.
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "lms_session";
const secret = () => new TextEncoder().encode(requireStrongSecret("AUTH_SECRET"));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// M9 audit finding #4: requireEnv only checked that AUTH_SECRET was
// *set* — a developer could set it to "123" and every session token
// in the app would be signed with a trivially guessable key, silently.
// This checks length too. 32 characters is a reasonable floor for an
// HMAC signing key (matches common guidance for HS256); it doesn't
// verify the value is actually random, since there's no way to detect
// "the developer typed a long but predictable string" from the string
// alone — .env.example's own placeholder is a reminder to generate one
// properly (e.g. `openssl rand -base64 32`), not something code can
// enforce.
function requireStrongSecret(name: string): string {
  const v = requireEnv(name);
  if (v.length < 32) {
    throw new Error(
      `${name} is too short (${v.length} characters) to be a safe signing key. ` +
        `Use at least 32 random characters — e.g. run: openssl rand -base64 32`
    );
  }
  // A length check alone isn't enough — .env.example's own placeholder
  // happens to be 33 characters, long enough to pass the check above
  // while being a publicly known, non-random value sitting in every
  // copy of this scaffold. Reject it explicitly rather than let a
  // developer who forgot to replace it ship a value with zero real
  // secrecy.
  if (v === "replace-with-a-long-random-string") {
    throw new Error(
      `${name} is still set to the .env.example placeholder value. Generate a real one: openssl rand -base64 32`
    );
  }
  return v;
}

export type Role = "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" | "TRAINEE" | "EMPLOYER";

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
}

// M9 audit finding #5: session length was a single hardcoded 12h for
// every role, inherited unchanged from the old admin-only design and
// never reconsidered once trainees existed. A staff member's 12h
// workday session and a trainee working through a multi-week course are
// different use cases — forcing a trainee to re-authenticate every 12
// hours mid-course is real friction with no corresponding security
// benefit, since staff (not trainees) are the ones performing the more
// sensitive actions (creating/publishing exams and course content).
//
// M31 — an employer isn't performing the same sensitive, frequent
// actions a trainee working through a multi-week course is; closer
// in shape to a staff member's occasional session than a trainee's
// long-running one, but genuinely its own new account type, not
// assumed identical to either existing one without a real reason.
// 24h — long enough to not be annoying for an infrequent visitor,
// short enough to matter for an account holding real applicant
// contact information once introductions start getting accepted.
//
// Settings-page redesign, Security category — these three numbers were
// a hardcoded constant for years with a comment saying "revisit... if
// real usage says otherwise," which nobody could actually act on
// without a code change and a deploy. Now admin-adjustable via
// PlatformSettings (see that model's own schema comment) — these
// values are only the FALLBACK, used if that row can't be read for any
// reason, and are deliberately byte-identical to the old constant so a
// database that's never had this row touched behaves exactly as before.
const DEFAULT_SESSION_HOURS: Record<Role, number> = {
  SUPER_ADMIN: 12,
  ADMIN: 12,
  INSTRUCTOR: 12,
  TRAINEE: 7 * 24,
  EMPLOYER: 24,
};

/**
 * Reads the admin-configured session length for this role, falling
 * back to the hardcoded defaults above on any failure — a transient DB
 * hiccup here must never be the reason someone can't log in. Staff
 * (SUPER_ADMIN/ADMIN/INSTRUCTOR) share one configured value, same
 * grouping the original hardcoded constant already used; TRAINEE and
 * EMPLOYER each get their own.
 */
async function getSessionDurationHours(role: Role): Promise<number> {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) return DEFAULT_SESSION_HOURS[role];
    switch (role) {
      case "TRAINEE":
        return settings.traineeSessionDays * 24;
      case "EMPLOYER":
        return settings.employerSessionHours;
      default:
        return settings.staffSessionHours;
    }
  } catch (e) {
    console.error(`Failed to read configured session duration for role ${role} — falling back to the default:`, e);
    return DEFAULT_SESSION_HOURS[role];
  }
}

// Audit finding, fixed here while adding a new role made it visible:
// the cookie's own maxAge was a SEPARATE, hand-maintained ternary that
// only ever special-cased TRAINEE, completely independent of the
// per-role duration above — meaning any role added later (like
// EMPLOYER, which needed its own 24h duration) would have its browser
// cookie expire at the OLD 12h default even though the JWT itself was
// still genuinely valid for 24h, silently logging that role out
// earlier than intended. Deriving both the JWT expiration and the
// cookie maxAge from the exact same number of hours closes this for
// good, rather than trusting two separately-maintained copies of the
// same duration to stay in sync by hand.
function hoursToSeconds(hours: number): number {
  return hours * 60 * 60;
}

export async function createSession(payload: SessionPayload) {
  const hours = await getSessionDurationHours(payload.role);
  // Still a relative "Nh" string into jose's setExpirationTime, exactly
  // the format that already worked here — only the number itself is
  // now dynamic instead of coming from a static map.
  const duration = `${hours}h`;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(duration)
    .sign(secret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: hoursToSeconds(hours),
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null; // expired or tampered — treat as logged out, don't throw
  }
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/**
 * Throws a 401-shaped error for API routes; call at the top of any
 * protected handler. With no arguments, just requires *any* logged-in
 * session. Pass specific roles to restrict further, e.g.
 * `requireRole("ADMIN", "SUPER_ADMIN")`.
 */
export async function requireRole(...allowed: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    const err = new Error("Not authenticated") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  if (allowed.length > 0 && !allowed.includes(session.role)) {
    const err = new Error("Not authorized for this action") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return session;
}
