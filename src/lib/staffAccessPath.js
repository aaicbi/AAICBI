/**
 * Where staff sign in. It lives on its own address that no public page links to, and the address
 * can be changed with the STAFF_SIGN_IN_PATH environment variable (read when the app is built).
 * Plain CommonJS so next.config.js can read it as well as the app. Hiding the address is not the
 * protection: every staff page and API still checks the session and role on the server.
 */
const DEFAULT_STAFF_PATH = "/internal-access/staff-sign-in";

// First path segments that already mean something in the app; the staff address may never sit on them.
const RESERVED = new Set([
  "", "api", "admin", "instructor", "trainee", "employer", "investor", "org", "exam", "feed", "search", "jobs", "learn", "courses",
  "p", "post", "compose", "my-posts", "saved", "tags", "notifications", "profile", "privacy-policy", "certificate",
  "certificate-templates", "events", "organizations", "startups", "trainees", "showcase", "staff-access", "app", "icons",
  "_next", "logo.svg", "sw.js", "manifest.webmanifest", "offline.html", "join", "login",
]);

/** Returns { path, valid, reason }. An unusable value falls back to the default, so a typo can never break staff sign-in. */
function resolveStaffPath(raw) {
  const value = (raw == null ? "" : String(raw)).trim();
  if (value === "") return { path: DEFAULT_STAFF_PATH, valid: true, reason: null };
  const fallback = (reason) => ({ path: DEFAULT_STAFF_PATH, valid: false, reason });
  if (!value.startsWith("/")) return fallback("must start with /");
  const path = value.replace(/\/+$/, "").toLowerCase();
  if (path.length < 8 || path.length > 80) return fallback("must be 8 to 80 characters");
  if (!/^\/[a-z0-9]+(?:[-_/][a-z0-9]+)*$/.test(path)) return fallback("use only lowercase letters, digits, hyphens, underscores and slashes");
  if (RESERVED.has(path.split("/")[1])) return fallback("starts with a path the app already uses");
  return { path, valid: true, reason: null };
}

/** The legacy address /admin/login stays available unless STAFF_LEGACY_LOGIN is "off". */
function isLegacyStaffLoginEnabled(raw) {
  return String(raw == null ? "" : raw).trim().toLowerCase() !== "off";
}

function staffSignInPath() {
  return resolveStaffPath(process.env.STAFF_SIGN_IN_PATH).path;
}

module.exports = { DEFAULT_STAFF_PATH, resolveStaffPath, isLegacyStaffLoginEnabled, staffSignInPath };
