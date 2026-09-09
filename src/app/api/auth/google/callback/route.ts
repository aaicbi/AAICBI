import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForIdentity, OAUTH_STATE_COOKIE } from "@/lib/auth/google";
import { completeTraineeLogin } from "@/lib/auth/completeTraineeLogin";
import { appUrl } from "@/lib/appUrl";

/**
 * GET /api/auth/google/callback — where Google redirects back to after
 * a trainee approves (or denies) the consent screen. Every failure
 * path redirects to a real page with a query-string error code rather
 * than returning a bare JSON error — the browser is mid-navigation at
 * this point, not making a fetch() call a page's own JS could catch.
 *
 * Reconciliation rules, in order (this is the "real decision about how
 * it reconciles with an account that already exists under the same
 * email" the roadmap flagged as the hard part of this feature):
 *   1. A trainee already linked to this exact Google account (by
 *      `googleId`) — log them in. The common case for a returning
 *      Google user.
 *   2. No `googleId` match, but an existing trainee already has this
 *      email — link this Google account to it (one trainee, now two
 *      ways in) and log them in. Only if Google itself reports the
 *      email verified; never trust an unverified address to silently
 *      take over an existing account.
 *   3. No match at all — only create a brand-new trainee if this flow
 *      started from the REGISTER page (`intent === "register"`, stored
 *      in the state cookie set by /start). Starting from the LOGIN
 *      page can never create an account — see /start's own comment on
 *      why: this app treats privacy-policy consent as a hard
 *      requirement for account creation, and the login page has no
 *      consent UI to have gathered it from.
 */
function redirectWithError(page: "login" | "register", code: string): NextResponse {
  return NextResponse.redirect(appUrl(`/trainee/${page}?error=${code}`));
}

export async function GET(req: NextRequest) {
  const stateParam = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const googleError = req.nextUrl.searchParams.get("error");

  const rawCookie = cookies().get(OAUTH_STATE_COOKIE)?.value;
  cookies().set(OAUTH_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 }); // single-use, clear it regardless of outcome

  let expected: { token: string; intent: "login" | "register" } | null = null;
  try {
    expected = rawCookie ? JSON.parse(rawCookie) : null;
  } catch {
    expected = null;
  }
  const intent = expected?.intent ?? "login";

  if (googleError) {
    // The most common real case is a trainee simply clicking "Cancel"
    // on Google's own consent screen — not a real error to alarm
    // anyone about, so this lands back on the page they started from
    // with no message at all, exactly as if they'd never clicked the
    // button.
    return NextResponse.redirect(appUrl(`/trainee/${intent === "register" ? "register" : "login"}`));
  }

  if (!expected || !stateParam || expected.token !== stateParam || !code) {
    return redirectWithError(intent === "register" ? "register" : "login", "oauth_failed");
  }

  let identity;
  try {
    identity = await exchangeCodeForIdentity(code);
  } catch (e) {
    console.error("Google sign-in: failed to exchange code / verify ID token:", e);
    return redirectWithError(intent === "register" ? "register" : "login", "oauth_failed");
  }

  // Case 1 — already linked.
  const linkedTrainee = await prisma.trainee.findUnique({ where: { googleId: identity.googleId } });
  if (linkedTrainee) {
    await completeTraineeLogin(linkedTrainee);
    return NextResponse.redirect(appUrl("/trainee/dashboard"));
  }

  // Case 2 — an existing account under the same, Google-verified email.
  const existingByEmail = await prisma.trainee.findUnique({ where: { email: identity.email } });
  if (existingByEmail) {
    if (!identity.emailVerified) {
      // A real, if unlikely, edge case — never silently attach a
      // Google identity to someone else's existing account off the
      // back of an address Google itself won't vouch for.
      return redirectWithError("login", "oauth_failed");
    }
    const linked = await prisma.trainee.update({
      where: { id: existingByEmail.id },
      data: { googleId: identity.googleId, emailVerified: true },
    });
    await completeTraineeLogin(linked);
    return NextResponse.redirect(appUrl("/trainee/dashboard"));
  }

  // Case 3 — no account at all.
  if (intent !== "register") {
    return redirectWithError("login", "no_account");
  }

  const created = await prisma.trainee.create({
    data: {
      name: identity.name,
      email: identity.email,
      googleId: identity.googleId,
      // Google already proved this address — the same meaning
      // `emailVerified` already has for the password path, just
      // reached a different way (no click-a-link step needed here).
      emailVerified: identity.emailVerified,
      avatarUrl: identity.pictureUrl,
      // Recorded the same way register/route.ts records it for the
      // password path — reaching this line at all requires having
      // clicked a Google button that was disabled until the same
      // privacy-consent checkbox was ticked (see the register page).
      privacyConsentAt: new Date(),
    },
  });
  await completeTraineeLogin(created);
  return NextResponse.redirect(appUrl("/trainee/dashboard"));
}
