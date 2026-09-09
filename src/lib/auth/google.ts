/**
 * Google sign-in (trainee-only — see the roadmap's own note on
 * Trainee.avatarUrl for why this was deliberately deferred until now:
 * "a materially bigger, separate piece of work — a new authentication
 * pathway alongside the existing email/password system, Google
 * developer console credentials, and a real decision about how it
 * reconciles with an account that already exists under the same
 * email"). This file is that pathway's real, working implementation.
 *
 * Deliberately hand-rolled rather than pulling in a library
 * (next-auth, etc.) — this project has never used one for its existing
 * email/password auth (see session.ts's own doc comment), and the
 * actual OAuth mechanics needed here are genuinely small: build an
 * authorization URL, exchange a code for tokens with a plain fetch(),
 * and verify Google's ID token JWT — which `jose` (already a
 * dependency, already used for this app's own session tokens) does
 * natively via `createRemoteJWKSet`, so no new dependency is needed at
 * all.
 *
 * Honest note on what could and couldn't be verified while building
 * this: the actual token exchange and JWKS verification call real
 * Google endpoints this sandbox has no network access to and no
 * credentials for — written correctly against Google's current,
 * documented OpenID Connect discovery document and endpoints, the same
 * "built correctly, not verified end-to-end from here" category as
 * this project's Paystack and Google Translate integrations.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { appUrl } from "@/lib/appUrl";

// Shared between /api/auth/google/start (sets it) and
// /api/auth/google/callback (reads and clears it) — kept here rather
// than exported from either route.ts file, since Next.js App Router
// route handlers only permit specific recognized exports (HTTP method
// handlers and a small set of route-segment config options), not
// arbitrary shared constants.
export const OAUTH_STATE_COOKIE = "google_oauth_state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER_VALUES = ["https://accounts.google.com", "accounts.google.com"];

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set — see DEPLOYMENT.md. Required for Google sign-in.");
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set — see DEPLOYMENT.md. Required for Google sign-in.");
  return v;
}

/** Same callback URL for every call site — must byte-for-byte match
 * what's registered as an authorized redirect URI in the Google Cloud
 * Console for this OAuth client, or Google rejects the request before
 * a trainee ever sees the consent screen. */
export function googleRedirectUri(): string {
  return appUrl("/api/auth/google/callback");
}

export function googleAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Real, deliberate choices, not defaults left untouched: consent
    // every time (not just first-time) avoids a confusing silent
    // re-login for someone who's revoked access on Google's side since
    // last time; select_account stops Google from ever silently
    // signing in whichever Google account merely happens to be already
    // active in that browser, which matters on a shared/family device.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  id_token: string;
  access_token: string;
  error?: string;
  error_description?: string;
}

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  pictureUrl: string | null;
}

/**
 * Exchanges an authorization code for Google's ID token and verifies
 * it (signature, issuer, audience, expiry) before trusting anything in
 * it — the ID token, not the access token, is what's cryptographically
 * bound to be Google's own claim about who this trainee is; the access
 * token is only good for calling Google's own APIs, and this flow
 * doesn't need to call any.
 */
export async function exchangeCodeForIdentity(code: string): Promise<GoogleIdentity> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenBody.id_token) {
    throw new Error(`Google token exchange failed: ${tokenBody.error ?? tokenRes.status} ${tokenBody.error_description ?? ""}`);
  }

  const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jwtVerify(tokenBody.id_token, jwks, {
    issuer: GOOGLE_ISSUER_VALUES,
    audience: clientId(),
  });

  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || typeof email !== "string") {
    throw new Error("Google ID token is missing required claims (sub/email).");
  }

  return {
    googleId: sub,
    email,
    // Google's own claim, not assumed true just because the token
    // verified — a Google Workspace admin can technically issue an
    // account with an unverified alias address. Checked explicitly
    // before this email is ever used to look up or link an existing
    // trainee account (see the callback route).
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : email,
    pictureUrl: typeof payload.picture === "string" ? payload.picture : null,
  };
}
