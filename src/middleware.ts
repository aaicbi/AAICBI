import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Edge-safe re-check of the session cookie. Kept separate from
// src/lib/auth/session.ts (which uses next/headers and isn't edge/route
// agnostic) — this only decides redirect-or-not; API routes still call
// requireRole(...) themselves as the real enforcement point. This file
// only checks "is there a valid session at all" — it does not itself
// check which role, since that would mean duplicating role logic in two
// places. A trainee who somehow lands on /admin/* still gets past this
// middleware but is then correctly 403'd by requireRole() in the route.
const COOKIE_NAME = "lms_session";

// M9 audit finding #4: /exam/* pages were reachable with no session at
// all — a visitor could browse the exam-code entry screen, the
// confirmation screen, and the instructions page before ever being
// asked to log in, only hitting a wall when the API itself rejected an
// unauthenticated POST to start the attempt. The API's requireRole
// check was already correct; the pages just hadn't caught up to it.
// Bringing /exam/* under the same middleware protection as /trainee/*
// means an unauthenticated visitor is redirected to login immediately,
// not several screens in.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Sidebar rollout — a role's layout.tsx (src/app/<role>/layout.tsx)
  // needs the current pathname to tell a genuine pre-auth page
  // (login, register, ...) apart from an authenticated one, since a
  // visitor who still has a valid session cookie can freely reach
  // e.g. /admin/login (this middleware's own PUBLIC_ADMIN_PATHS below
  // never redirects them away from it) — without this, that layout
  // only had session validity to go on and wrongly wrapped the login
  // form in the sidebar. Server Components have no other way to read
  // the current path; this is the documented Next.js pattern for it.
  // Forwarded for every request this middleware runs on, not just the
  // protected ones, so the header is there even on genuinely public
  // pre-auth pages.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const withPathname = () => NextResponse.next({ request: { headers: requestHeaders } });

  const PUBLIC_TRAINEE_PATHS = new Set([
    "/trainee/login",
    "/trainee/register",
    "/trainee/verify", // reachable pre-login on purpose — see verify/page.tsx
    "/trainee/forgot-password",
    "/trainee/reset-password", // reached from an emailed link, before any session exists
  ]);
  const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/forgot-password", "/admin/reset-password"]);

  const isAdminPath = pathname.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.has(pathname);
  const isTraineePath = pathname.startsWith("/trainee") && !PUBLIC_TRAINEE_PATHS.has(pathname);
  const isExamPath = pathname.startsWith("/exam");
  if (!isAdminPath && !isTraineePath && !isExamPath) return withPathname();

  const loginPath = isAdminPath ? "/admin/login" : "/trainee/login";
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    // Preserve where they were headed so login can send them back —
    // otherwise redirecting a trainee off, say, /exam/AAICBI-EXCEL-DEMO
    // just because they weren't logged in yet would strand them on the
    // dashboard after signing in, having lost the exam code entirely.
    const redirectUrl = new URL(loginPath, req.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return withPathname();
  } catch {
    const redirectUrl = new URL(loginPath, req.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  // employer/investor added for the x-pathname header alone (see the
  // comment above) — they hit the early `withPathname()` return
  // immediately below, since isAdminPath/isTraineePath/isExamPath are
  // all false for them: no redirect/token logic newly applies to
  // these two, their existing page-level auth checks are unaffected.
  // instructor isn't listed — it has no pre-auth pages at all, so its
  // layout never needs this header (see InstructorLayout's comment).
  matcher: ["/admin/:path*", "/trainee/:path*", "/exam/:path*", "/employer/:path*", "/investor/:path*"],
};
