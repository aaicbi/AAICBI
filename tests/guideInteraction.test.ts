import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PLAYBOOKS } from "@/lib/guide/playbooks";
import { GUIDE_DESTINATIONS } from "@/lib/guide/navigation";
import { advance, cardPlacement, nearlyTouch, completes, onStepPage, spotExpired, SPOT_SHOWN_MS, SPOT_WAIT_MS, stepBack, targetSelector, TARGET_ID } from "@/lib/guide/interaction";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}
const SRC = sourceFiles("src").map((f) => readFileSync(f, "utf8")).join("\n");

describe("guide targets", () => {
  it("builds a safe selector from an id", () => {
    expect(targetSelector("create-course")).toBe('[data-guide-target="create-course"]');
    expect(targetSelector('a"b')).toBe('[data-guide-target="a\\"b"]');
    expect(TARGET_ID.test("nav:/admin/courses")).toBe(true);
    expect(TARGET_ID.test('x"] y')).toBe(false);
  });

  it("every target a guide step names exists: a menu item of its audience, or a control that carries the id", () => {
    const missing: string[] = [];
    for (const p of PLAYBOOKS) {
      for (const s of p.steps) {
        if (!s.target) continue;
        if (!TARGET_ID.test(s.target)) missing.push(`${p.id}: bad id ${s.target}`);
        else if (s.target.startsWith("nav:")) {
          const d = GUIDE_DESTINATIONS.find((x) => x.target === s.target);
          const audience = p.audience === "organization" ? "organization" : "trainee";
          if (!d) missing.push(`${p.id}: no menu item ${s.target}`);
          else if (!d.audience.includes(audience as never)) missing.push(`${p.id}: ${s.target} is not in the ${audience} menu`);
        } else if (!SRC.includes(`data-guide-target="${s.target}"`)) missing.push(`${p.id}: no control carries ${s.target}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every menu renders its items with their target id", () => {
    for (const f of ["trainee/TraineeSidebar", "employer/EmployerSidebar", "investor/InvestorSidebar", "admin/AdminSidebar"]) {
      expect(readFileSync(`src/components/${f}.tsx`, "utf8"), f).toContain("data-guide-target={navTarget(item.href)}");
    }
    const bottom = readFileSync("src/components/pwa/MobileBottomNav.tsx", "utf8");
    expect(bottom).toContain("data-guide-target={navTarget(t.href)}");
    expect(bottom).toContain('data-guide-target="more"');
  });

  it("a step on another page names that page", () => {
    for (const p of PLAYBOOKS) for (const s of p.steps) if (s.target && !s.target.startsWith("nav:")) expect(s.page, `${p.id}: ${s.title}`).toBeTruthy();
  });
});

describe("what counts as doing a step", () => {
  it("matches the kind of control", () => {
    expect(completes("click", "click")).toBe(true);
    expect(completes("change", "click")).toBe(false);
    expect(completes("change", "input")).toBe(true);
    expect(completes("input", "input")).toBe(true);
    expect(completes("click", "submit")).toBe(true);
    expect(completes("submit", "submit")).toBe(true);
    for (const e of ["click", "input", "change", "submit"] as const) expect(completes(e, "none")).toBe(false);
  });
  it("knows which page a step belongs to", () => {
    expect(onStepPage(undefined, "/anything")).toBe(true);
    expect(onStepPage("/admin/courses", "/admin/courses")).toBe(true);
    expect(onStepPage("/admin/courses", "/admin/courses/abc")).toBe(true);
    expect(onStepPage("/admin/courses/new", "/admin/courses")).toBe(false);
    expect(onStepPage("/admin/courses", "/admin/coursesx")).toBe(false);
  });
});

describe("moving through a guide", () => {
  it("advances, stops at the end, and goes back without going below the start", () => {
    const s = { id: "x", step: 0 };
    expect(advance(s, 3)).toEqual({ id: "x", step: 1 });
    expect(advance({ id: "x", step: 2 }, 3)).toBeNull();
    expect(stepBack({ id: "x", step: 0 }).step).toBe(0);
    expect(stepBack({ id: "x", step: 2 }).step).toBe(1);
  });
  it("lets a spot-light go after it was seen, or if the control never appeared", () => {
    const spot = { target: "a", at: 1000 };
    expect(spotExpired(spot, 1000 + SPOT_SHOWN_MS - 1, true)).toBe(false);
    expect(spotExpired(spot, 1000 + SPOT_SHOWN_MS + 1, true)).toBe(true);
    expect(spotExpired(spot, 1000 + SPOT_SHOWN_MS + 1, false)).toBe(false);
    expect(spotExpired(spot, 1000 + SPOT_WAIT_MS + 1, false)).toBe(true);
  });
  it("keeps the card clear of the control, moving it once if it would touch", () => {
    const card = { top: 600, bottom: 700, left: 20, right: 360 };
    expect(cardPlacement("bottom", card, { top: 100, bottom: 140, left: 20, right: 200 })).toBe("bottom");
    expect(cardPlacement("bottom", card, { top: 650, bottom: 690, left: 20, right: 200 })).toBe("top");
    expect(cardPlacement("bottom", card, { top: 560, bottom: 595, left: 20, right: 200 })).toBe("top");
    expect(cardPlacement("top", { top: 10, bottom: 110, left: 20, right: 360 }, { top: 40, bottom: 80, left: 20, right: 200 })).toBe("bottom");
    expect(cardPlacement("bottom", null, null)).toBe("bottom");
    expect(nearlyTouch({ top: 0, bottom: 10, left: 0, right: 10 }, { top: 40, bottom: 50, left: 0, right: 10 })).toBe(false);
  });
});

describe("motion and accessibility", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const beam = css.slice(css.indexOf(".guide-beam {"));
  it("has a reduced-motion version with no animation", () => {
    const reduced = beam.slice(beam.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/animation: none/);
    expect(reduced).toMatch(/\.guide-beam::before/);
  });
  it("never flashes: the loops are slow", () => {
    for (const m of beam.matchAll(/animation: [a-z-]+ ([\d.]+)s/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(2.5);
  });
  it("the overlay does not intercept touches", () => {
    expect(beam).toMatch(/pointer-events: none/);
  });
});
