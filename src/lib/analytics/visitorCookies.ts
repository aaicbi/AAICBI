/**
 * Analytics System Phase 2 — the two first-party cookies anonymous
 * visitor tracking uses, following the exact same `cookies()` (from
 * `next/headers`) pattern already established by
 * `createSession`/`clearSession` in src/lib/auth/session.ts.
 *
 * Opt-in, not opt-out: `aaicbi_visitor_id` is only ever created here, by
 * `ensureVisitorId()`, which is only ever called from
 * POST /api/analytics/consent — and only when the decision is
 * "accepted". POST /api/analytics/visitor-event deliberately only
 * READS this cookie (`getVisitorId()`), never creates it — a request
 * that arrives with consent "accepted" but somehow no visitor-id cookie
 * yet (a genuinely unexpected ordering) is treated as not-yet-trackable
 * rather than silently creating one out of band.
 */
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const CONSENT_COOKIE = "aaicbi_cookie_consent";
export const VISITOR_ID_COOKIE = "aaicbi_visitor_id";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export type ConsentDecision = "accepted" | "declined";

export function getConsentDecision(): ConsentDecision | null {
  const value = cookies().get(CONSENT_COOKIE)?.value;
  return value === "accepted" || value === "declined" ? value : null;
}

export function setConsentDecision(decision: ConsentDecision): void {
  // NOT httpOnly — the banner component reads this directly via
  // document.cookie so it knows not to re-render, the same reasoning
  // the existing `theme` cookie (src/app/layout.tsx) already uses for a
  // client-readable preference.
  cookies().set(CONSENT_COOKIE, decision, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export function getVisitorId(): string | null {
  return cookies().get(VISITOR_ID_COOKIE)?.value ?? null;
}

/** Only ever call when the consent decision is genuinely "accepted". */
export function ensureVisitorId(): string {
  const existing = getVisitorId();
  if (existing) return existing;
  const id = randomUUID();
  cookies().set(VISITOR_ID_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return id;
}

/** Clears both cookies — the "Manage Cookie Preferences" withdrawal path. */
export function clearConsentAndVisitorId(): void {
  cookies().set(CONSENT_COOKIE, "", { path: "/", maxAge: 0 });
  cookies().set(VISITOR_ID_COOKIE, "", { path: "/", maxAge: 0 });
}
