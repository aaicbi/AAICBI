import { describe, expect, it } from "vitest";
import { getAdminNavGroups } from "@/lib/admin/nav";

const has = (role: string, org: boolean) => getAdminNavGroups(role, org).flatMap((g) => g.items).some((i) => i.href === "/admin/requests");

describe("Change requests in the sidebar", () => {
  it("is shown to Super Admins only", () => {
    expect(has("SUPER_ADMIN", false)).toBe(true);
    expect(has("ADMIN", false)).toBe(false);
    expect(has("INSTRUCTOR", false)).toBe(false);
    expect(has("ADMIN", true)).toBe(false);
  });
});
