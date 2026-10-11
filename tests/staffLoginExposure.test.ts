import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (d: string, out: string[] = []): string[] => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) files(p, out); else if (/\.(tsx?|jsx?)$/.test(n)) out.push(p.replace(/\\/g, "/")); } return out; };
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Staff-side code may send a signed-out staff member to their sign-in; nothing else may mention it.
const STAFF_SIDE = /^src\/(app\/(admin|instructor|staff-access)\/|components\/(admin|instructor)\/|middleware\.ts|lib\/(staffAccessPath\.js|sidebarRoutes\.ts|guide\/navigation\.ts))/;

describe("staff sign-in is not exposed to the public", () => {
  const all = [...files("src")];
  it("no public page or shared component links to the staff sign-in or says 'Staff Login'", () => {
    for (const f of all.filter((f) => !STAFF_SIDE.test(f))) {
      const src = strip(readFileSync(f, "utf8"));
      expect(src, f).not.toMatch(/\/admin\/login|\/staff-access|internal-access|Staff Login/);
    }
  });
  it("the internal page is never linked and is noindex", () => {
    const page = readFileSync("src/app/staff-access/page.tsx", "utf8");
    expect(page).toMatch(/index: false/);
  });
  it("middleware answers 404 to direct requests for the internal page", () => {
    const mw = readFileSync("src/middleware.ts", "utf8");
    expect(mw).toMatch(/pathname === "\/staff-access"/);
    expect(mw).toMatch(/status: 404/);
  });
  it("public registration code can never create a staff account", () => {
    const creators = all.filter((f) => /prisma\.user\.create\(/.test(readFileSync(f, "utf8")));
    for (const f of creators) {
      // The only places that create staff are admin-only routes, which check the role on the server.
      expect(f, f).toMatch(/^src\/app\/api\/admin\//);
      expect(readFileSync(f, "utf8"), f).toMatch(/requireRole\(|requireStaffRole\(|SUPER_ADMIN/);
    }
  });
});
