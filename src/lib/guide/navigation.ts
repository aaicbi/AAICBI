import { getAdminNavGroups } from "@/lib/admin/nav";
import { EMPLOYER_NAV, EMPLOYER_ORGANIZATIONS_NAV } from "@/lib/employer/nav";
import { INVESTOR_NAV, INVESTOR_ORGANIZATIONS_NAV } from "@/lib/investor/nav";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import { DESTINATIONS, isAvailable } from "@/lib/guide/links";
import type { MeKind } from "@/lib/guide/context";
import { tokens } from "@/lib/guide/text";
import type { GuideSwitches } from "@/lib/guide/types";

/**
 * Where Loop can take someone, built from the menus the platform already
 * has (so a renamed or moved page is followed automatically) plus the public
 * pages. Each place knows which kind of account may open it, so Loop never
 * points an employer at a trainee page or highlights a control an account
 * does not have.
 */
export type Audience = MeKind | "any" | "signedIn";

export interface GuideDestination {
  label: string;
  href: string;
  audience: Audience[];
  /** Other names people use for it. */
  aliases: string[];
  /** The control to light up for this place: its menu item. */
  target: string;
}

/** The marker a menu item carries so Loop can find and light it: one id per page address. */
export const navTarget = (href: string) => `nav:${href}`;

const ALIASES: Record<string, string[]> = {
  "/trainee/examinations": ["assessment results", "exam results", "results", "assessments", "exams", "tests", "grades"],
  "/trainee/my-activity": ["analytics", "reports", "my activity", "stats", "statistics"],
  "/trainee/certificates": ["certificate", "my certificate", "download certificate"],
  "/trainee/progress": ["progress", "how am i doing"],
  "/trainee/messages": ["chat", "inbox", "conversations", "dm", "message"],
  "/trainee/buddy": ["learning buddy", "study buddy", "ai buddy"],
  "/trainee/courses": ["my courses", "training", "programs", "lessons", "learn"],
  "/trainee/downloads": ["offline", "downloaded materials"],
  "/trainee/settings": ["account settings", "password", "preferences", "notifications settings"],
  "/trainee/profile": ["my profile", "profile picture", "avatar", "profile settings"],
  "/trainee/introductions": ["introductions", "employer requests"],
  "/trainee/job-postings": ["job board", "jobs", "apply for a job", "opportunities"],
  "/employer/messages": ["chat", "inbox", "conversations", "message trainees"],
  "/employer/discover": ["find talent", "talent", "trainees", "candidates", "search trainees"],
  "/employer/job-postings": ["post a job", "jobs", "job posting", "vacancies", "applications", "applicants"],
  "/employer/introductions": ["introductions", "requests"],
  "/employer/settings": ["account settings", "password", "preferences"],
  "/employer/status": ["account status", "verification"],
  "/investor/dashboard": ["investment opportunities", "pitches", "opportunities"],
  "/admin/courses": ["manage courses", "training management", "create course", "create a course", "programs", "my courses", "upload course"],
  "/admin/exams": ["examinations", "course exam", "assessments"],
  "/admin/assignments": ["assignments", "homework"],
  "/admin/messages": ["chat", "inbox", "conversations", "message trainees"],
  "/admin/payments": ["payments", "money", "revenue", "reports"],
  "/admin/performance": ["performance", "results", "trainee progress"],
  "/admin/analytics": ["analytics", "statistics", "stats"],
  "/admin/certificate-templates": ["certificate studio", "design certificates", "certificate designer", "templates"],
  "/admin/settings": ["settings", "account", "password"],
  "/admin/organization": ["organization overview", "workspace", "my organization"],
  "/admin/organization/profile": ["public page", "organization page", "public profile"],
  "/admin/organization/team": ["teammates", "invite teammate", "staff"],
  "/admin/organization/events": ["post an event", "events"],
  "/admin/organization/programs": ["program skills", "tag skills"],
  "/admin/organization/insights": ["content visibility", "how is my content doing"],
  "/admin/education": ["education videos", "trainee videos", "videos"],
  "/notifications": ["alerts", "notifications", "bell", "updates"],
};

const dest = (label: string, href: string, audience: Audience[]): GuideDestination => ({ label, href, audience, aliases: ALIASES[href] ?? [], target: navTarget(href) });

function build(): GuideDestination[] {
  const out = new Map<string, GuideDestination>();
  const add = (d: GuideDestination) => {
    const existing = out.get(d.href);
    if (existing) {
      for (const a of d.audience) if (!existing.audience.includes(a)) existing.audience.push(a);
    } else out.set(d.href, { ...d, audience: [...d.audience] });
  };
  for (const n of TRAINEE_NAV) add(dest(n.label, n.href, ["trainee"]));
  add(dest("My profile", "/trainee/profile", ["trainee"]));
  add(dest("Introductions", "/trainee/introductions", ["trainee"]));
  add(dest("Job board", "/trainee/job-postings", ["trainee"]));
  for (const n of [...EMPLOYER_NAV, EMPLOYER_ORGANIZATIONS_NAV]) add(dest(n.label, n.href, ["employer"]));
  for (const n of [...INVESTOR_NAV, INVESTOR_ORGANIZATIONS_NAV]) add(dest(n.label, n.href, ["investor"]));
  // The real sidebar lists: a training organization's own, and the full staff one.
  for (const g of getAdminNavGroups("ADMIN", true)) for (const n of g.items) add(dest(n.label, n.href, ["organization"]));
  for (const g of getAdminNavGroups("SUPER_ADMIN", false)) for (const n of g.items) add(dest(n.label, n.href, ["staff"]));
  for (const g of getAdminNavGroups("ADMIN", true)) for (const n of g.items) if (areaOf(n.href) === "staff") add(dest(n.label, n.href, ["organization", "staff"]));
  add(dest("Notifications", "/notifications", ["signedIn"]));
  for (const d of DESTINATIONS) add({ label: d.label, href: d.href, audience: ["any"], aliases: [], target: navTarget(d.href) });
  return [...out.values()];
}

export const GUIDE_DESTINATIONS: GuideDestination[] = build();

/** The areas a page address belongs to, by its first part. */
export function areaOf(href: string): Audience {
  const p = href.split("#")[0].split("?")[0];
  if (p === "/trainee/login" || p === "/trainee/register" || p.startsWith("/trainee/forgot") || p.startsWith("/trainee/reset") || p.startsWith("/trainee/verify")) return "any";
  if (p.startsWith("/trainee")) return "trainee";
  if (p === "/employer/login" || p === "/employer/register") return "any";
  if (p.startsWith("/employer")) return "employer";
  if (p === "/investor/login" || p === "/investor/register") return "any";
  if (p.startsWith("/investor")) return "investor";
  if (p === "/admin/login" || p.startsWith("/admin/forgot") || p.startsWith("/admin/reset")) return "any";
  if (p.startsWith("/admin/organization")) return "organization";
  if (p.startsWith("/admin") || p.startsWith("/instructor")) return "staff";
  if (p === "/notifications") return "signedIn";
  return "any";
}

/** Whether this kind of account may open a page. A visitor (null) only gets the public pages. */
export function canOpen(href: string, me: MeKind | null): boolean {
  const area = areaOf(href);
  if (area === "any") return true;
  if (area === "signedIn") return me !== null;
  if (me === null) return false;
  if (area === "staff") return me === "staff" || (me === "organization" && GUIDE_DESTINATIONS.some((d) => d.href === href && d.audience.includes("organization")));
  return area === me;
}

/** Places this kind of account may go, with the ecosystem switches applied. */
export function destinationsFor(me: MeKind | null, on: GuideSwitches): GuideDestination[] {
  return GUIDE_DESTINATIONS.filter((d) => canOpen(d.href, me) && isAvailable(d.href, on) && (d.audience.includes("any") || d.audience.includes("signedIn") || (me !== null && d.audience.includes(me))));
}

const FIND_MIN = 0.6;

function score(query: string[], d: GuideDestination): number {
  if (query.length === 0) return 0;
  const names = [d.label, ...d.aliases];
  let best = 0;
  for (const name of names) {
    const t = new Set(tokens(name));
    if (t.size === 0) continue;
    const q = new Set(query);
    let hit = 0;
    for (const w of q) if (t.has(w)) hit++;
    const qcov = hit / q.size;
    const ncov = hit / t.size;
    best = Math.max(best, 0.7 * qcov + 0.3 * ncov);
  }
  return best;
}

export type Resolution =
  | { kind: "found"; dest: GuideDestination }
  | { kind: "denied"; dest: GuideDestination; owner: Audience }
  | { kind: "none" };

/**
 * The place a request names ("analytics", "my messages"), for this account.
 * Prefers something the account can open; when the best match belongs to
 * another kind of account, says so instead of pointing at the wrong page.
 */
export function resolveDestination(subject: string, me: MeKind | null, on: GuideSwitches): Resolution {
  const q = tokens(subject);
  if (q.length === 0) return { kind: "none" };
  const mine = destinationsFor(me, on)
    .map((d) => ({ d, s: score(q, d) }))
    .filter((x) => x.s >= FIND_MIN)
    .sort((a, b) => b.s - a.s || a.d.label.length - b.d.label.length);
  if (mine[0]) return { kind: "found", dest: mine[0].d };
  const others = GUIDE_DESTINATIONS.filter((d) => !canOpen(d.href, me) && isAvailable(d.href, on))
    .map((d) => ({ d, s: score(q, d) }))
    .filter((x) => x.s >= 0.8)
    .sort((a, b) => b.s - a.s);
  if (others[0]) return { kind: "denied", dest: others[0].d, owner: areaOf(others[0].d.href) };
  return { kind: "none" };
}

const OWNER_NAME: Record<string, string> = {
  trainee: "trainees",
  employer: "employers",
  investor: "investors",
  organization: "training organizations",
  staff: "AAICBI staff",
  signedIn: "signed-in accounts",
};

const JOIN: Record<string, { label: string; href: string }> = {
  trainee: { label: "Create a trainee account", href: "/trainee/register" },
  employer: { label: "Register as an employer", href: "/employer/register" },
  investor: { label: "Register as an investor", href: "/investor/register" },
  organization: { label: "Register your organization", href: "/org/register" },
};

/** What to say when a feature belongs to another kind of account, and how to get access if that is possible. */
export function deniedReply(d: GuideDestination, owner: Audience, me: MeKind | null): { text: string; links: Array<{ label: string; href: string }> } {
  const who = OWNER_NAME[owner] ?? "other accounts";
  const text = me === null
    ? `${d.label} is available to ${who}. Sign in with that kind of account to use it.`
    : `That feature (${d.label}) is available to ${who}. Your current account doesn't have access to it.`;
  const join = JOIN[owner];
  return { text, links: join && owner !== me ? [join] : [] };
}
