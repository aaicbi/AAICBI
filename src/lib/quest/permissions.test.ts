import { describe, expect, it } from "vitest";
import { ALL_STUDIO_PERMISSIONS, DEFAULT_STUDIO_PERMISSIONS, STUDIO_PERMISSIONS, TOOL_PERMISSION, cleanPermissions, mayUseTool, permissionsFrom } from "@/lib/quest/permissions";
import { LOOP_ACTIONS } from "@/lib/loop/actions";
import { LOOP_TOOL_SCHEMAS } from "@/lib/loop/tools";

describe("studio permissions", () => {
  it("gives a person nobody has configured the studio set only, never platform-wide tools", () => {
    expect(permissionsFrom(null)).toEqual(DEFAULT_STUDIO_PERMISSIONS);
    expect(permissionsFrom("junk")).toEqual(DEFAULT_STUDIO_PERMISSIONS);
    for (const p of STUDIO_PERMISSIONS) if (p.wide) expect(DEFAULT_STUDIO_PERMISSIONS).not.toContain(p.key);
  });
  it("keeps an explicit empty list empty and drops unknown keys", () => {
    expect(permissionsFrom([])).toEqual([]);
    expect(cleanPermissions(["GAMES", "NOPE", "LOOP"])).toEqual(["LOOP", "GAMES"]);
    expect(cleanPermissions("GAMES")).toEqual([]);
  });
  it("lets a tool through only with its permission, and the engine's own module-scoped reads always", () => {
    expect(mayUseTool("create_game", ["GAMES"])).toBe(true);
    expect(mayUseTool("create_game", ["ITEMS"])).toBe(false);
    expect(mayUseTool("send_message", DEFAULT_STUDIO_PERMISSIONS)).toBe(false);
    expect(mayUseTool("send_message", ["MESSAGING"])).toBe(true);
    expect(mayUseTool("find_module", [])).toBe(true);
    expect(mayUseTool("not_a_tool", [...ALL_STUDIO_PERMISSIONS])).toBe(false);
  });
  it("covers every Loop action and platform read, so a new one cannot reach staff by accident", () => {
    const own = new Set(["find_module", "get_module_details", "read_module_materials", "list_games", "get_game_items"]);
    const replaced = new Set(["analyze_module_materials"]);
    const offered = [...LOOP_ACTIONS.map((a) => a.name), ...(LOOP_TOOL_SCHEMAS as { name: string }[]).map((t) => t.name)].filter((n) => !own.has(n) && !replaced.has(n));
    // Super-Admin-only on purpose: they have no entry, so staff can never be given them.
    const superOnly = new Set(["log_change_request"]);
    const missing = offered.filter((n) => !TOOL_PERMISSION[n] && !superOnly.has(n));
    expect(missing).toEqual([]);
    expect(mayUseTool("log_change_request", [...ALL_STUDIO_PERMISSIONS])).toBe(false);
  });
});
