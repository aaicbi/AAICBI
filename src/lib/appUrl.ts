/**
 * M14 — every notification that links back into the app (verify,
 * reset password, course/module links) needs an ABSOLUTE URL, not a
 * relative one — email clients don't have "the app" as a base URL the
 * way a browser tab does. This project had no base-URL convention
 * before M14 because nothing needed one until now (every other route
 * returns relative paths for the client-side app to navigate with).
 *
 * Falls back to localhost for local development so this never throws
 * just because APP_URL isn't set yet — a broken link in a dev-only
 * test email is a much smaller problem than a route crashing outright.
 */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
