import type { GuideLink, GuideSwitches } from "@/lib/guide/types";

/**
 * Every page the guide may send someone to, in one list: the landing
 * pages of the ecosystem's main groups, the sign-up and sign-in pages for
 * each role, and a few help pages. Built-in answers may only link to
 * these (a test enforces it), and the Command Center link picker offers
 * exactly these. A link added by hand there may be any path on this site.
 */
export interface Destination extends GuideLink {
  /** Which ecosystem switch must be on for this page to exist. */
  needs?: keyof GuideSwitches | "education+orgPages";
  group: "Explore" | "Join" | "Sign in" | "Help";
}

export const DESTINATIONS: Destination[] = [
  { label: "Explore the ecosystem", href: "/#ecosystem", group: "Explore" },
  { label: "Browse training programs", href: "/courses", group: "Explore" },
  { label: "Upcoming programs", href: "/courses/upcoming", group: "Explore" },
  { label: "See opportunities", href: "/jobs", needs: "publicJobs", group: "Explore" },
  { label: "Meet training organizations", href: "/organizations", needs: "orgPages", group: "Explore" },
  { label: "Explore trainees", href: "/trainees", needs: "publicTrainees", group: "Explore" },
  { label: "See upcoming events", href: "/events", needs: "orgPages", group: "Explore" },
  { label: "Watch educational videos", href: "/learn", needs: "education+orgPages", group: "Explore" },
  { label: "Community feed", href: "/feed", needs: "feed", group: "Explore" },
  { label: "Search the ecosystem", href: "/search", needs: "orgPages", group: "Explore" },
  { label: "Community showcase", href: "/showcase", group: "Explore" },
  { label: "Verify a certificate", href: "/certificate", group: "Explore" },
  { label: "Join the ecosystem", href: "/#join", group: "Join" },
  { label: "Create a trainee account", href: "/trainee/register", group: "Join" },
  { label: "Register your organization", href: "/org/register", group: "Join" },
  { label: "Register as an employer", href: "/employer/register", group: "Join" },
  { label: "Register as an investor", href: "/investor/register", group: "Join" },
  { label: "Trainee sign in", href: "/trainee/login", group: "Sign in" },
  { label: "Organization sign in", href: "/org/login", group: "Sign in" },
  { label: "Employer sign in", href: "/employer/login", group: "Sign in" },
  { label: "Investor sign in", href: "/investor/login", group: "Sign in" },
  { label: "Staff sign in", href: "/admin/login", group: "Sign in" },
  { label: "Reset a trainee password", href: "/trainee/forgot-password", group: "Help" },
  { label: "Reset a staff password", href: "/admin/forgot-password", group: "Help" },
  { label: "Your Learning Buddy", href: "/trainee/buddy", group: "Help" },
  { label: "Your settings", href: "/trainee/settings", group: "Help" },
];

const BY_HREF = new Map(DESTINATIONS.map((d) => [d.href, d]));

function path(href: string): string {
  return href.split("#")[0].split("?")[0] || "/";
}

/** Whether the page a link points at is currently available, given the ecosystem switches. */
export function isAvailable(href: string, on: GuideSwitches): boolean {
  const p = path(href);
  const known = BY_HREF.get(p) ?? BY_HREF.get(href);
  const needs = known?.needs ?? inferNeeds(p);
  if (!needs) return true;
  if (needs === "education+orgPages") return on.education && on.orgPages;
  return on[needs];
}

/** Pages under a switch that are not in the directory (a search with a word, an organization page) still follow it. */
function inferNeeds(p: string): Destination["needs"] | undefined {
  if (p === "/jobs" || p.startsWith("/jobs/")) return "publicJobs";
  if (p === "/trainees") return "publicTrainees";
  if (p === "/organizations" || p.startsWith("/organizations/") || p === "/events" || p === "/search") return "orgPages";
  if (p === "/learn" || p.startsWith("/learn/")) return "education+orgPages";
  if (p === "/feed") return "feed";
  return undefined;
}

export function filterLinks(links: GuideLink[], on: GuideSwitches): GuideLink[] {
  return links.filter((l) => isAvailable(l.href, on));
}

/**
 * A link is safe to show only if it is a path on this site: starts with a
 * single slash, no scheme, no protocol-relative form, no whitespace or
 * control characters, and a sensible length. Used on every link before it
 * is stored or rendered, so an answer can never send someone off-site.
 */
export function isSafeHref(href: string): boolean {
  if (typeof href !== "string" || href.length === 0 || href.length > 200) return false;
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/\\")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f\\]/.test(href)) return false;
  return !/^\/+[a-z][a-z0-9+.-]*:/i.test(href);
}

export function sanitizeLinks(links: unknown): GuideLink[] {
  if (!Array.isArray(links)) return [];
  const out: GuideLink[] = [];
  for (const l of links) {
    if (!l || typeof l !== "object") continue;
    const { label, href } = l as { label?: unknown; href?: unknown };
    if (typeof label !== "string" || typeof href !== "string") continue;
    const text = label.trim().slice(0, 60);
    if (!text || !isSafeHref(href)) continue;
    out.push({ label: text, href });
    if (out.length >= 5) break;
  }
  return out;
}

const dest = (href: string): GuideLink => {
  const d = BY_HREF.get(href);
  if (!d) throw new Error(`Unknown destination ${href}`);
  return { label: d.label, href: d.href };
};

/** A link from the directory, by path. Throws for an unknown one, so a typo in the built-in answers fails at once. */
export function link(href: string, label?: string): GuideLink {
  const d = dest(href);
  return label ? { label, href: d.href } : d;
}
