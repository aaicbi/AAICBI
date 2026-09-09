import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { googleAuthorizationUrl, OAUTH_STATE_COOKIE } from "@/lib/auth/google";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { appUrl } from "@/lib/appUrl";

const STATE_TTL_SECONDS = 10 * 60; // long enough for a real consent screen, short enough to limit a stolen/replayed cookie's value

/**
 * GET /api/auth/google/start?intent=login|register — the redirect a
 * trainee lands on the moment they click "Sign in with Google."
 * `intent` decides what the callback is allowed to do with a Google
 * account that has no matching trainee yet: `register` may create one
 * (only reachable from the register page, itself gated behind the same
 * privacy-consent checkbox the password path already requires — see
 * that page); `login` never does, so clicking "Sign in with Google" on
 * the LOGIN page can never silently create an account with zero
 * consent UI shown, which this app's own password-registration route
 * treats as a hard requirement, not a nicety.
 *
 * The `state` value is the actual CSRF defense (standard OAuth
 * practice): a random token stored in an httpOnly cookie here, and
 * required to match byte-for-byte on the callback before anything in
 * the callback is trusted — see that route. `intent` rides alongside
 * it in the same cookie rather than in the (attacker-visible, replayable
 * without the cookie) `state` query param itself, though either would
 * be safe here since the callback's trust boundary is the cookie match,
 * not obscurity of what `state` contains.
 */
export async function GET(req: NextRequest) {
  const limited = await rateLimit(`google-oauth-start:${clientIp(req)}`, 20, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const intentParam = req.nextUrl.searchParams.get("intent");
  const intent = intentParam === "register" ? "register" : "login";

  const token = randomBytes(24).toString("hex");

  // `googleAuthorizationUrl` throws if GOOGLE_CLIENT_ID isn't
  // configured (see google.ts's own clientId()) — a real, expected
  // state in any environment that hasn't set this up yet, not
  // something that should ever surface as a raw 500. Caught here
  // rather than wrapped in withApiErrors (which returns JSON, not a
  // useful response for a route whose entire job is redirecting a
  // real browser navigation).
  let authorizationUrl: string;
  try {
    authorizationUrl = googleAuthorizationUrl(token);
  } catch (e) {
    console.error("Google sign-in is not configured:", e);
    return NextResponse.redirect(appUrl(`/trainee/${intent === "register" ? "register" : "login"}?error=oauth_not_configured`));
  }

  cookies().set(OAUTH_STATE_COOKIE, JSON.stringify({ token, intent }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // required for this cookie to survive the top-level redirect back from Google
    path: "/api/auth/google",
    maxAge: STATE_TTL_SECONDS,
  });

  return NextResponse.redirect(authorizationUrl);
}
