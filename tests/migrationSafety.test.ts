import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261025090000_search_indexes/migration.sql"), "utf8");

describe("search index migration cannot block a deploy", () => {
  it("wraps everything in a guarded DO block", () => {
    expect(sql).toMatch(/DO \$mig\$/);
    expect((sql.match(/EXCEPTION WHEN OTHERS/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
  it("guards CREATE EXTENSION and never uses CONCURRENTLY", () => {
    const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(code).not.toMatch(/CONCURRENTLY/);
    const before = code.slice(0, code.indexOf("CREATE EXTENSION"));
    expect(before.trim().endsWith("BEGIN")).toBe(true);
  });
  it("sets a lock timeout and creates indexes idempotently", () => {
    expect(sql).toMatch(/lock_timeout/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });
});
