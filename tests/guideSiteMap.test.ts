import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DYNAMIC, NOT_LISTED, PAGES } from "@/lib/guide/siteMap";
import { GUIDE_DESTINATIONS } from "@/lib/guide/navigation";

const APP = join(process.cwd(), "src/app");

/** Every page.tsx under src/app (not the API), as the address it serves. */
function routes(dir = APP, base = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name === "api") continue;
    const next = `${base}/${name}`;
    if (existsSync(join(full, "page.tsx"))) out.push(next);
    out.push(...routes(full, next));
  }
  if (base === "" && existsSync(join(dir, "page.tsx"))) out.push("/");
  return out;
}

const all = routes();
const isDynamic = (r: string) => /\[/.test(r);
// Pages Loop must never mention (the staff sign-in is deliberately not public); kept here, not in the app code.
const SECRET = ["/staff-access", "/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const listed = new Set([...PAGES.map((p) => p.href), ...DYNAMIC.map((d) => d.route), ...NOT_LISTED.map((n) => n.route), ...SECRET]);

describe("Loop knows every page of the platform", () => {
  it("lists every page in the app (add a line to src/lib/guide/siteMap.ts when you add a page)", () => {
    const missing = all.filter((r) => !listed.has(r));
    expect(missing, `Pages Loop does not know about: ${missing.join(", ")}`).toEqual([]);
  });
  it("lists no page that no longer exists", () => {
    const gone = [...listed].filter((r) => !all.includes(r));
    expect(gone, `Pages in the site map that do not exist: ${gone.join(", ")}`).toEqual([]);
  });
  it("has no address twice, and no static page marked dynamic", () => {
    const hrefs = PAGES.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(PAGES.filter((p) => isDynamic(p.href))).toEqual([]);
    expect(DYNAMIC.filter((d) => !isDynamic(d.route))).toEqual([]);
  });
  it("sends every dynamic page's readers to a page that exists", () => {
    const known = new Set(PAGES.map((p) => p.href));
    expect(DYNAMIC.filter((d) => !known.has(d.from)).map((d) => d.route)).toEqual([]);
  });
  it("describes every page in a sentence", () => {
    expect(PAGES.filter((p) => p.what.trim().length < 15).map((p) => p.href)).toEqual([]);
  });
  it("never lists the staff sign-in", () => {
    const text = JSON.stringify(PAGES) + JSON.stringify(DYNAMIC) + JSON.stringify(NOT_LISTED);
    for (const s of SECRET) expect(text).not.toContain(s);
    expect(text).not.toMatch(/Staff sign|Staff Login/i);
  });
  it("is part of what Loop can open, for the right kind of account", () => {
    const by = new Map(GUIDE_DESTINATIONS.map((d) => [d.href, d]));
    for (const p of PAGES) expect(by.has(p.href), p.href).toBe(true);
    expect(by.get("/compose")!.audience).toContain("signedIn");
    expect(by.get("/trainee/profile")!.audience).toContain("trainee");
    expect(by.get("/admin/review")!.audience).not.toContain("organization");
  });
});

import { buildMenu } from "@/lib/guide/navigation";
import { isMapRequest } from "@/lib/guide/intent";

const ON = { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true };
const hrefsOf = (me: Parameters<typeof buildMenu>[0], on = ON) => buildMenu(me, on).flatMap((g) => g.items.map((i) => i.href));

describe("Loop's map of everywhere an account can go", () => {
  it("recognises a request for the whole map", () => {
    for (const q of ["Show me everything I can open", "site map", "what pages are there?", "list all the pages", "where can I go", "everything I can do", "navigate the platform", "map of the platform"]) expect(isMapRequest(q), q).toBe(true);
    for (const q of ["where is my certificate", "how do I post", "open my dashboard"]) expect(isMapRequest(q), q).toBe(false);
  });
  it("gives a visitor the public pages and the way in, and nothing signed-in only", () => {
    const h = hrefsOf(null);
    expect(h).toEqual(expect.arrayContaining(["/feed", "/search", "/jobs", "/join", "/login"]));
    for (const x of ["/compose", "/trainee/dashboard", "/admin/dashboard", "/employer/dashboard"]) expect(h).not.toContain(x);
  });
  it("gives each kind of account its own area and not another's", () => {
    const trainee = hrefsOf("trainee");
    expect(trainee).toEqual(expect.arrayContaining(["/trainee/dashboard", "/trainee/profile", "/compose", "/my-posts", "/notifications", "/trainee/certificates"]));
    expect(trainee).not.toEqual(expect.arrayContaining(["/employer/dashboard"]));
    expect(trainee).not.toContain("/admin/review");
    expect(trainee).not.toContain("/join"); // already signed in
    const employer = hrefsOf("employer");
    expect(employer).toEqual(expect.arrayContaining(["/employer/discover", "/employer/job-postings", "/compose"]));
    expect(employer).not.toContain("/trainee/profile");
    const org = hrefsOf("organization");
    expect(org).toEqual(expect.arrayContaining(["/admin/organization/team", "/admin/courses", "/admin/certificate-templates", "/org/billing"]));
    expect(org).not.toContain("/admin/review");
    expect(org).not.toContain("/admin/ecosystem");
    const staff = hrefsOf("staff");
    expect(staff).toEqual(expect.arrayContaining(["/admin/review", "/admin/ecosystem", "/admin/command/guide", "/instructor/dashboard"]));
  });
  it("leaves out pages whose switch is off", () => {
    const h = hrefsOf(null, { ...ON, publicJobs: false, feed: false });
    expect(h).not.toContain("/jobs");
    expect(h).not.toContain("/feed");
  });
  it("describes every place", () => {
    for (const me of [null, "trainee", "employer", "investor", "organization", "staff"] as const) for (const g of buildMenu(me, ON)) for (const i of g.items) expect(i.what.length, i.href).toBeGreaterThan(10);
  });
});
