/**
 * Where a new member goes right after creating an account: the sign-in form, with their email filled in and a notice at the top
 * telling them to open the verification link we emailed. Pure (no browser, no database) so it can be tested. Only an address that
 * looks like an email and an internal path ever end up in the link.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function safeInternalPath(p: string | null | undefined): string | null {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

export function signupLoginUrl(opts: { email: string; next?: string | null; startupProblem?: boolean }): string {
  const q = new URLSearchParams({ registered: "1" });
  const email = opts.email.trim();
  if (EMAIL.test(email)) q.set("email", email);
  const next = safeInternalPath(opts.next);
  if (next) q.set("next", next);
  if (opts.startupProblem) q.set("note", "startup-problem");
  return `/trainee/login?${q.toString()}`;
}

export interface SignupNotice { show: boolean; email: string; startupProblem: boolean }

export function parseSignupNotice(get: (k: string) => string | null): SignupNotice {
  const show = get("registered") === "1";
  const raw = (get("email") ?? "").trim();
  return { show, email: show && EMAIL.test(raw) ? raw : "", startupProblem: show && get("note") === "startup-problem" };
}
