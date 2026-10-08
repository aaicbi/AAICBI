import { describe, it, expect } from "vitest";
import { planSteps } from "../scripts/vercel-build.mjs";

type Step = { label: string; args: string[]; env?: { DATABASE_URL: string } };
const plan = (env: Record<string, string | undefined>) => planSteps(env) as Step[];
const labels = (env: Record<string, string | undefined>) => plan(env).map((s) => s.label);

describe("vercel build plan", () => {
  it("migrates between generating the client and building, on production", () => {
    expect(labels({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://prod" })).toEqual([
      "Generate the Prisma client",
      "Apply database migrations",
      "Build the app",
    ]);
  });

  it("uses migrate deploy, never a command that can reset data", () => {
    const m = plan({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://prod" }).find((s) => s.label === "Apply database migrations")!;
    expect(m.args).toEqual(["prisma", "migrate", "deploy"]);
  });

  it("does not touch the database for previews, local builds or when skipped", () => {
    for (const env of [{ VERCEL_ENV: "preview", DATABASE_URL: "x" }, { DATABASE_URL: "x" }, { VERCEL_ENV: "production", DATABASE_URL: "x", SKIP_DB_MIGRATE: "1" }]) {
      expect(labels(env)).toEqual(["Generate the Prisma client", "Build the app"]);
    }
  });

  it("prefers MIGRATE_DATABASE_URL for the migration only", () => {
    const steps = plan({ VERCEL_ENV: "production", DATABASE_URL: "postgresql://pooled", MIGRATE_DATABASE_URL: "postgresql://direct" });
    expect(steps.find((s) => s.label === "Apply database migrations")!.env).toEqual({ DATABASE_URL: "postgresql://direct" });
    expect(steps.find((s) => s.label === "Build the app")!.env).toBeUndefined();
  });

  it("refuses a production build with no database URL", () => {
    expect(() => planSteps({ VERCEL_ENV: "production" })).toThrow(/DATABASE_URL/);
  });
});

describe("Neon pooled connection for migrations", () => {
  const pooled = "postgresql://u:p@ep-falling-butterfly-b1rpavsf-pooler.c-5.eu-central-1.aws.neon.tech:5432/db?sslmode=require";
  it("migrates over the direct host when only the pooled URL is set", async () => {
    const m = plan({ VERCEL_ENV: "production", DATABASE_URL: pooled }).find((s) => s.label === "Apply database migrations")!;
    expect(m.env!.DATABASE_URL).toBe("postgresql://u:p@ep-falling-butterfly-b1rpavsf.c-5.eu-central-1.aws.neon.tech:5432/db?sslmode=require");
  });
  it("leaves other hosts and an explicit MIGRATE_DATABASE_URL alone", async () => {
    const { directNeonUrl } = await import("../scripts/vercel-build.mjs");
    expect(directNeonUrl("postgresql://u:p@db.example.com:5432/x")).toBe("postgresql://u:p@db.example.com:5432/x");
    expect(directNeonUrl("not a url")).toBe("not a url");
    const m = plan({ VERCEL_ENV: "production", DATABASE_URL: pooled, MIGRATE_DATABASE_URL: "postgresql://mine" }).find((s) => s.label === "Apply database migrations")!;
    expect(m.env!.DATABASE_URL).toBe("postgresql://mine");
  });
});
