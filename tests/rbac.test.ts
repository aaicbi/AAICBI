import { describe, it, expect } from "vitest";
import { ACTIONS, CATEGORIES, HIGH_RISK, ORG_PERMISSIONS, PERMISSIONS, STAFF_PERMISSIONS, applyGates, cleanKeys, isPermissionKey } from "@/lib/rbac/catalogue";
import { ROLE_TEMPLATES, templateOf } from "@/lib/rbac/templates";
import { LEGACY_DEFAULTS, legacyDefaults } from "@/lib/rbac/legacy";
import { DEFAULT_ORG_POLICY, resolveOrganization, resolveStaff } from "@/lib/rbac/resolve";
import { bulkSelectable, diffKeys, mayChange } from "@/lib/rbac/authority";

const staff = (o: Partial<Parameters<typeof resolveStaff>[0]> = {}) => ({ role: "ADMIN", active: true, staffRoleKey: null, grants: [], denies: [], ...o });

describe("the catalogue", () => {
  it("has unique, well-formed keys that use only known actions", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of PERMISSIONS) {
      expect(p.key).toBe(`${p.featureId}:${p.action}`);
      expect(p.featureId.startsWith(p.categoryId + ".")).toBe(true);
      expect(ACTIONS).toContain(p.action);
    }
  });
  it("keeps staff and organization permissions in separate categories", () => {
    expect(STAFF_PERMISSIONS.some((k) => k.startsWith("org_games."))).toBe(false);
    expect(ORG_PERMISSIONS.every((k) => k.startsWith("org_games."))).toBe(true);
    expect(CATEGORIES.find((c) => c.id === "org_games")?.audience).toBe("organization");
  });
  it("separates the Gaming Studio from gaming moderation", () => {
    expect(STAFF_PERMISSIONS.filter((k) => k.startsWith("gaming_studio.")).length).toBeGreaterThan(5);
    expect(STAFF_PERMISSIONS.filter((k) => k.startsWith("gaming_ops.")).every((k) => !k.startsWith("gaming_studio."))).toBe(true);
    expect(isPermissionKey("gaming_studio.games:publish")).toBe(true);
    expect(isPermissionKey("gaming_studio.games:fly")).toBe(false);
  });
  it("marks the dangerous ones", () => {
    for (const k of ["staff.permissions:assign_permissions", "gaming_studio.games:publish", "gaming_studio.settings:configure", "platform.settings:configure", "reports.export:export", "security.integrations:manage", "billing.settings:configure"]) {
      expect(HIGH_RISK).toContain(k);
    }
  });
  it("cleanKeys drops unknown, duplicate and wrong-audience keys", () => {
    expect(cleanKeys(["gaming_ops.results:view", "gaming_ops.results:view", "nope:view", "org_games.results:view", 5])).toEqual(["gaming_ops.results:view"]);
    expect(cleanKeys("x")).toEqual([]);
  });
  it("applies gates: nothing in the Gaming Studio counts without access to it", () => {
    expect([...applyGates(["gaming_studio.games:create", "gaming_ops.results:view"])]).toEqual(["gaming_ops.results:view"]);
    expect(applyGates(["gaming_studio.access:view", "gaming_studio.games:create"]).has("gaming_studio.games:create")).toBe(true);
  });
});

describe("role templates", () => {
  it("are the eight suggested ones and contain only real staff permissions", () => {
    expect(ROLE_TEMPLATES.map((t) => t.key)).toEqual(["platform_admin", "gaming_studio_admin", "gaming_ops_moderator", "org_support", "trainee_course_admin", "content_moderator", "reports_officer", "technical_support"]);
    for (const t of ROLE_TEMPLATES) {
      expect(t.permissions.length).toBeGreaterThan(0);
      expect(t.permissions.every((k) => STAFF_PERMISSIONS.includes(k))).toBe(true);
    }
  });
  it("never give moderation the Studio, nor the Studio administrator the power to moderate players", () => {
    expect(templateOf("gaming_ops_moderator")!.permissions.some((k) => k.startsWith("gaming_studio."))).toBe(false);
    expect(templateOf("gaming_studio_admin")!.permissions.some((k) => k.startsWith("gaming_ops.sessions") || k.startsWith("gaming_ops.restrictions"))).toBe(false);
  });
  it("keep the platform administrator away from staff management, the Studio and every high-risk permission", () => {
    const p = templateOf("platform_admin")!.permissions;
    expect(p.some((k) => k.startsWith("gaming_studio.") || HIGH_RISK.includes(k))).toBe(false);
    expect(p).not.toContain("staff.permissions:assign_permissions");
  });
});

describe("resolving a staff member", () => {
  it("gives a Super Admin everything, which overrides cannot remove (no lock-out)", () => {
    const s = resolveStaff(staff({ role: "SUPER_ADMIN", denies: STAFF_PERMISSIONS, staffRoleKey: "nonexistent" }));
    expect(s.size).toBe(STAFF_PERMISSIONS.length);
  });
  it("leaves an untouched account exactly as its role always was, and never gives it the Studio", () => {
    for (const r of ["ADMIN", "INSTRUCTOR"]) {
      const s = resolveStaff(staff({ role: r }));
      expect([...s].sort()).toEqual(legacyDefaults(r).sort());
      expect([...s].some((k) => k.startsWith("gaming_studio."))).toBe(false);
    }
    expect(LEGACY_DEFAULTS.INSTRUCTOR.every((k) => LEGACY_DEFAULTS.ADMIN.includes(k))).toBe(true);
  });
  it("denies everything for a switched-off account and for roles that are not staff", () => {
    expect(resolveStaff(staff({ active: false })).size).toBe(0);
    for (const r of ["TRAINEE", "EMPLOYER", "INVESTOR", "WHATEVER"]) expect(resolveStaff(staff({ role: r })).size).toBe(0);
  });
  it("uses a template, then explicit grants, then explicit denies", () => {
    const base = resolveStaff(staff({ staffRoleKey: "gaming_ops_moderator" }));
    expect(base.has("gaming_ops.sessions:moderate")).toBe(true);
    expect(base.has("gaming_studio.access:view")).toBe(false);
    const more = resolveStaff(staff({ staffRoleKey: "gaming_ops_moderator", grants: ["billing.payments:view"], denies: ["gaming_ops.sessions:moderate"] }));
    expect(more.has("billing.payments:view")).toBe(true);
    expect(more.has("gaming_ops.sessions:moderate")).toBe(false);
  });
  it("lets moderation and Studio permissions be granted independently", () => {
    const view = resolveStaff(staff({ staffRoleKey: "gaming_ops_moderator", grants: ["gaming_studio.access:view", "gaming_studio.configs:view"] }));
    expect(view.has("gaming_studio.configs:view")).toBe(true);
    expect(view.has("gaming_studio.games:publish")).toBe(false);
    expect(view.has("gaming_studio.games:delete")).toBe(false);
    const noDoor = resolveStaff(staff({ staffRoleKey: "gaming_ops_moderator", grants: ["gaming_studio.games:create"] }));
    expect(noDoor.has("gaming_studio.games:create")).toBe(false);
  });
  it("denies by default for an unknown role key and ignores unknown permission keys", () => {
    expect(resolveStaff(staff({ staffRoleKey: "made_up" })).size).toBe(0);
    expect(resolveStaff(staff({ staffRoleKey: "made_up", grants: ["bogus:view", "billing.payments:view"] })).size).toBe(1);
  });
  it("reads a custom role", () => {
    const s = resolveStaff(staff({ staffRoleKey: "my_role" }), { my_role: ["reports.dashboards:view", "nope"] });
    expect([...s]).toEqual(["reports.dashboards:view"]);
  });
});

describe("resolving an organization", () => {
  it("never returns anything outside organization games: no Studio, no platform control", () => {
    for (const role of ["OWNER", "MANAGER", "EDITOR", "VIEWER"] as const) {
      for (const k of resolveOrganization(role, { ...DEFAULT_ORG_POLICY, resultsExport: true, toggleGames: true, courseRules: true })) expect(k.startsWith("org_games.")).toBe(true);
    }
  });
  it("lets owners and managers moderate by default and editors and viewers only look", () => {
    expect(resolveOrganization("OWNER").has("org_games.sessions:moderate")).toBe(true);
    expect(resolveOrganization("MANAGER").has("org_games.restrictions:manage")).toBe(true);
    for (const r of ["EDITOR", "VIEWER"] as const) {
      const s = resolveOrganization(r);
      expect(s.has("org_games.results:view")).toBe(true);
      expect(s.has("org_games.sessions:moderate")).toBe(false);
      expect(s.has("org_games.restrictions:manage")).toBe(false);
    }
  });
  it("follows the Super Admin's switches", () => {
    const off = resolveOrganization("OWNER", { ...DEFAULT_ORG_POLICY, resultsView: false, liveMonitor: false, endSessions: false, restrictTrainees: false, removeParticipants: false, chatGameModeration: false, courseRules: false });
    expect(off.size).toBe(0);
    expect(resolveOrganization("OWNER").has("org_games.results:export")).toBe(false);
    expect(resolveOrganization("OWNER", { ...DEFAULT_ORG_POLICY, resultsExport: true }).has("org_games.results:export")).toBe(true);
    expect(resolveOrganization("MANAGER", { ...DEFAULT_ORG_POLICY, toggleGames: true }).has("org_games.settings:configure")).toBe(true);
    expect(resolveOrganization("EDITOR", { ...DEFAULT_ORG_POLICY, toggleGames: true }).has("org_games.settings:configure")).toBe(false);
  });
});

describe("who may change permissions", () => {
  const sa = { id: "s", role: "SUPER_ADMIN", permissions: new Set(STAFF_PERMISSIONS) };
  const delegate = { id: "d", role: "ADMIN", permissions: new Set(["staff.permissions:assign_permissions", "billing.payments:view", "reports.dashboards:view", "gaming_studio.games:publish"]) };
  it("lets a Super Admin change an admin or instructor, but never themselves or another Super Admin", () => {
    expect(mayChange(sa, { id: "x", role: "ADMIN" }, [], ["billing.payments:view"]).ok).toBe(true);
    expect(mayChange(sa, { id: "s", role: "ADMIN" }, [], []).ok).toBe(false);
    expect(mayChange(sa, { id: "y", role: "SUPER_ADMIN" }, [], []).ok).toBe(false);
    expect(mayChange(sa, { id: "z", role: "TRAINEE" }, [], []).ok).toBe(false);
  });
  it("stops anyone without the delegation permission", () => {
    const plain = { id: "p", role: "ADMIN", permissions: new Set(["billing.payments:view"]) };
    expect(mayChange(plain, { id: "x", role: "INSTRUCTOR" }, [], ["billing.payments:view"]).ok).toBe(false);
  });
  it("keeps a delegate inside what they hold and away from high-risk permissions", () => {
    expect(mayChange(delegate, { id: "x", role: "INSTRUCTOR" }, [], ["billing.payments:view"]).ok).toBe(true);
    const beyond = mayChange(delegate, { id: "x", role: "INSTRUCTOR" }, [], ["billing.payments:view", "security.logs:view"]);
    expect(beyond.ok).toBe(false);
    expect(mayChange(delegate, { id: "x", role: "INSTRUCTOR" }, [], ["gaming_studio.games:publish"]).ok).toBe(false);
    expect(mayChange(delegate, { id: "x", role: "INSTRUCTOR" }, ["staff.permissions:assign_permissions"], []).ok).toBe(false);
  });
  it("computes what changed", () => {
    expect(diffKeys(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
  });
  it("keeps bulk selection away from high-risk permissions", () => {
    const keys = PERMISSIONS.filter((p) => p.categoryId === "gaming_studio").map((p) => p.key);
    const picked = bulkSelectable(keys, sa);
    expect(picked).toContain("gaming_studio.configs:view");
    expect(picked).not.toContain("gaming_studio.access:view"); // the door is switched on deliberately, never by a bulk tick
    expect(picked.some((k) => HIGH_RISK.includes(k))).toBe(false);
  });
});
