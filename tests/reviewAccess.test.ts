import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (d: string, out: string[] = []): string[] => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) files(p, out); else if (/\.(ts|tsx)$/.test(n)) out.push(p); } return out; };

describe("what reviewers can and cannot reach", () => {
  const reviewRoutes = files("src/app/api/admin/review").filter((f) => f.endsWith("route.ts"));
  it("has review routes to check", () => expect(reviewRoutes.length).toBeGreaterThanOrEqual(4));
  it("every review route checks for a reviewer on the server", () => {
    for (const f of reviewRoutes) expect(readFileSync(f, "utf8"), f).toMatch(/requireReviewer\(\)/);
  });
  it("review routes and the reviewing code never reach Loop's settings, the consultant or AI guidance", () => {
    const reach = [...reviewRoutes, "src/lib/guide/review.ts", "src/lib/review/queue.ts"];
    for (const f of reach) {
      // Comments may mention the words; only the code counts.
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(src, f).not.toMatch(/consultant|aiGuidance|guideConsultantEnabled|saveGuidance|restoreGuidance/i);
    }
  });
  it("the consultant, AI guidance and Loop settings stay super admin only", () => {
    const guarded = files("src/app/api/admin/guide").filter((f) => f.endsWith("route.ts") && /consultant|ai-guidance|guide\/route\.ts$/.test(f.replace(/\\/g, "/")));
    expect(guarded.length).toBeGreaterThan(5);
    for (const f of guarded) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/requireReviewer/);
      expect(src, f).toMatch(/guideActor\(\)|requireRole\("SUPER_ADMIN"\)/);
    }
  });
  it("reviewer permission is granted only through the super admin's staff route", () => {
    const src = readFileSync("src/app/api/admin/staff/[id]/route.ts", "utf8");
    expect(src).toMatch(/requireRole\("SUPER_ADMIN"\)/);
    for (const f of files("src/app/api").filter((x) => x.endsWith("route.ts") && !x.includes("admin/staff"))) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/canReview:\s*(true|parsed|body)/);
    }
  });
});
