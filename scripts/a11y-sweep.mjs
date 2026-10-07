#!/usr/bin/env node
/**
 * Automated accessibility sweep. Opens every page listed in
 * scripts/a11y-pages.json as the role that owns it, in both themes, runs
 * axe-core (WCAG 2.0 and 2.1, levels A and AA) and prints the pages with
 * violations. Exits 1 if there are any.
 *
 * This catches what a machine can catch (contrast, names, roles, labels,
 * structure). It does not replace testing with real assistive technology;
 * see docs/accessibility-testing.md for that.
 *
 *   BASE_URL=http://localhost:3000 \
 *   A11Y_PASSWORD='...' npm run a11y
 *
 * Needs a running app with test accounts for each role in the config
 * (all sharing A11Y_PASSWORD). CHROMIUM_PATH points at a Chromium or
 * Chrome binary; it defaults to Playwright's own path on the dev images.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = process.env.A11Y_PASSWORD;
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const config = JSON.parse(readFileSync(new URL("./a11y-pages.json", import.meta.url), "utf8"));

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
let failures = 0;
let checked = 0;

for (const theme of ["dark", "light"]) {
  for (const [role, spec] of Object.entries(config.roles)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([
      { name: "theme", value: theme, url: BASE },
      { name: "aaicbi_cookie_consent", value: "declined", url: BASE },
    ]);
    if (spec.login) {
      if (!PASSWORD) throw new Error("Set A11Y_PASSWORD for the test accounts.");
      const res = await context.request.post(BASE + spec.login.url, { data: { email: spec.login.email, password: PASSWORD } });
      if (!res.ok()) throw new Error(`Login failed for ${role} (${res.status()})`);
    }
    const page = await context.newPage();
    for (const path of spec.paths) {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      checked += 1;
      if (violations.length) {
        failures += violations.length;
        console.log(`\n${role} / ${theme} / ${path}`);
        for (const v of violations) {
          console.log(`  ${v.id} [${v.impact}] x${v.nodes.length}: ${v.help}`);
          for (const node of v.nodes.slice(0, 2)) console.log(`    ${node.target.join(" ")}`);
        }
      }
    }
    await context.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} violation(s) across ${checked} page checks.` : `\nNo violations across ${checked} page checks.`);
process.exit(failures ? 1 : 0);
