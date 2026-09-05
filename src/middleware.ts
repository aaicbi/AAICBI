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
  if (!isAdminPath && !isTraineePath && !isExamPath) return NextResponse.next();

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
    return NextResponse.next();
  } catch {
    const redirectUrl = new URL(loginPath, req.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/trainee/:path*", "/exam/:path*"],
};
