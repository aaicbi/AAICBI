#!/usr/bin/env node
/**
 * Vercel's build command (the "vercel-build" script in package.json).
 *
 * On a production deployment it applies any pending database migrations
 * first, then builds the app. If a migration fails the build fails, so the
 * previous deployment keeps serving and the new code never goes live
 * against a database that is missing its tables.
 *
 * Preview deployments (pull requests) and local builds never touch the
 * database: previews often share the production DATABASE_URL, and a
 * half-reviewed branch must not change it.
 *
 * Settings (all optional, set in Vercel > Project > Settings > Environment Variables):
 *   (Neon pooled URLs are switched to the direct host automatically.)
 *   MIGRATE_DATABASE_URL  Use this connection for migrations instead of
 *                         DATABASE_URL. Point it at Neon's direct (non-pooler)
 *                         host; migrations take a lock that pooled connections
 *                         can drop.
 *   SKIP_DB_MIGRATE=1     Build without migrating (an escape hatch).
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Neon's pooled host ("...-pooler...") sits behind pgbouncer, which cannot
 * hold the advisory lock `prisma migrate deploy` takes (error P1002). Its
 * direct host is the same name without "-pooler". Only that exact Neon
 * pattern is rewritten; any other URL is returned untouched.
 */
export function directNeonUrl(url) {
  try {
    const u = new URL(url);
    if (!/-pooler\./.test(u.hostname) || !u.hostname.endsWith(".neon.tech")) return url;
    u.hostname = u.hostname.replace("-pooler.", ".");
    return u.toString();
  } catch {
    return url;
  }
}

/** The commands to run, in order, for a given environment. Pure so it can be tested. */
export function planSteps(env) {
  const steps = [{ label: "Generate the Prisma client", cmd: "npx", args: ["prisma", "generate"] }];
  if (env.VERCEL_ENV === "production" && env.SKIP_DB_MIGRATE !== "1") {
    const url = env.MIGRATE_DATABASE_URL || (env.DATABASE_URL ? directNeonUrl(env.DATABASE_URL) : undefined);
    if (!url) throw new Error("Production build needs DATABASE_URL (or MIGRATE_DATABASE_URL) to apply migrations.");
    steps.push({
      label: "Apply database migrations",
      cmd: "npx",
      args: ["prisma", "migrate", "deploy"],
      env: { DATABASE_URL: url },
    });
  }
  steps.push({ label: "Build the app", cmd: "npx", args: ["next", "build"] });
  return steps;
}

function main() {
  let steps;
  try {
    steps = planSteps(process.env);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (!steps.some((s) => s.label === "Apply database migrations")) {
    console.log(`Skipping database migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "not set"}).`);
  }
  for (const step of steps) {
    console.log(`\n> ${step.label}`);
    // A sleeping Neon database can miss the first migration lock; retry that step only.
    const attempts = step.label === "Apply database migrations" ? 3 : 1;
    let r;
    for (let i = 1; i <= attempts; i++) {
      r = spawnSync(step.cmd, step.args, { stdio: "inherit", env: { ...process.env, ...step.env }, shell: process.platform === "win32" });
      if (r.status === 0) break;
      if (i < attempts) console.log(`\nAttempt ${i} of ${attempts} failed; trying again in 5 seconds.`);
      if (i < attempts) spawnSync("node", ["-e", "setTimeout(()=>{},5000)"]);
    }
    if (r.status !== 0) {
      console.error(`\n"${step.label}" failed (exit ${r.status ?? "signal"}). Stopping the build.`);
      process.exit(r.status ?? 1);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
