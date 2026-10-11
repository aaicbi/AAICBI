/**
 * Handles for the profile layer: the short unique name in /@handle. Pure
 * rules (no database) so they can be tested. One handle namespace covers
 * every kind of account, so a person, an organization and a startup can never
 * share one.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Top-level routes and words nobody may take as a handle. */
export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "api", "app", "about", "account", "aaicbi", "futybills", "support", "help", "root", "system", "staff", "team", "official", "moderator", "reviewer",
  "feed", "explore", "search", "events", "jobs", "courses", "learn", "learning", "messages", "notifications", "settings", "profile", "profiles", "p", "u", "me", "new", "null", "undefined",
  "login", "logout", "register", "signup", "signin", "privacy-policy", "terms", "trainee", "trainees", "employer", "employers", "investor", "investors", "org", "organization", "organizations", "startup", "startups",
  "instructor", "certificate", "certificates", "exam", "showcase", "static", "public", "sw", "manifest", "offline",
]);

const SHAPE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export type HandleCheck = { ok: true; handle: string } | { ok: false; error: string };

/** Lowercases and trims what a person typed (a leading @ is allowed). */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function validateHandle(raw: unknown): HandleCheck {
  if (typeof raw !== "string") return { ok: false, error: "Choose a handle." };
  const handle = normalizeHandle(raw);
  if (handle.length < HANDLE_MIN) return { ok: false, error: `A handle needs at least ${HANDLE_MIN} characters.` };
  if (handle.length > HANDLE_MAX) return { ok: false, error: `A handle can be at most ${HANDLE_MAX} characters.` };
  if (!SHAPE.test(handle)) return { ok: false, error: "Use only letters, numbers, hyphens and underscores, starting and ending with a letter or number." };
  if (RESERVED_HANDLES.has(handle)) return { ok: false, error: "That handle is reserved. Please choose another." };
  return { ok: true, handle };
}

/** Turns any name into a handle-shaped string ("Nexus Training Academy" → "nexus-training-academy"). */
export function slugifyForHandle(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, HANDLE_MAX).replace(/-+$/g, "");
}

/**
 * A free handle based on `base`: the base itself when it is valid and not
 * taken, otherwise the base with a number added. Falls back to `member` when
 * the base is unusable (empty, or only symbols).
 */
export function suggestHandle(base: string, isTaken: (h: string) => boolean): string {
  let root = slugifyForHandle(base);
  if (root.length < HANDLE_MIN) root = root ? `${root}-${"member".slice(0, HANDLE_MIN)}`.slice(0, HANDLE_MAX) : "member";
  const ok = (h: string) => validateHandle(h).ok && !isTaken(h);
  if (ok(root)) return root;
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`;
    const candidate = root.slice(0, HANDLE_MAX - suffix.length).replace(/-+$/g, "") + suffix;
    if (ok(candidate)) return candidate;
  }
  return `${root.slice(0, 20)}-${Date.now().toString(36)}`.slice(0, HANDLE_MAX);
}
