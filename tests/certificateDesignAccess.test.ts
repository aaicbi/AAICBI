import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES = [
  "src/app/api/admin/training-organizations/[id]/certificate-templates/route.ts",
  "src/app/api/admin/training-organizations/[id]/certificate-backgrounds/route.ts",
  "src/app/api/admin/certificate-templates/[id]/route.ts",
  "src/app/api/admin/certificate-templates/[id]/logo/route.ts",
  "src/app/api/admin/certificate-templates/[id]/send-review/route.ts",
  "src/app/api/admin/certificate-icons/route.ts",
];

describe("certificate design is staff and organization only", () => {
  it("every design route checks for an admin role and never lists trainees", () => {
    for (const r of ROUTES) {
      const src = readFileSync(join(process.cwd(), r), "utf8");
      const roles = [...src.matchAll(/requireRole\(([^)]*)\)/g)].map((m) => m[1]);
      expect(roles.length, r).toBeGreaterThan(0);
      for (const list of roles) {
        expect(list, r).toMatch(/SUPER_ADMIN/);
        expect(list, r).not.toMatch(/TRAINEE|EMPLOYER|INVESTOR|INSTRUCTOR/);
      }
    }
  });

  it("the staff-area layout sends other signed-in roles home", () => {
    const src = readFileSync(join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
    expect(src).toMatch(/!isStaff && pageHasSidebar\(pathname\)/);
    expect(src).toMatch(/\/trainee\/dashboard/);
  });
});
