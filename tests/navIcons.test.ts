import { describe, it, expect } from "vitest";
import { LayoutGrid } from "lucide-react";
import { getAdminNavGroups } from "@/lib/admin/nav";
import { getNavIcon } from "@/components/icons/navIcons";

describe("admin sidebar icons", () => {
  it("gives every admin destination its own icon instead of the generic grid", () => {
    for (const [role, org] of [["SUPER_ADMIN", false], ["ADMIN", false], ["ADMIN", true]] as const) {
      for (const item of getAdminNavGroups(role, org).flatMap((g) => g.items)) {
        expect(getNavIcon(item.href), `${role}${org ? " (org)" : ""}: ${item.label}`).not.toBe(LayoutGrid);
      }
    }
  });

  it("uses a different icon for each organization workspace page", () => {
    const hrefs = ["/admin/organization", "/admin/organization/team", "/admin/organization/profile", "/admin/education", "/admin/organization/programs", "/admin/organization/insights", "/admin/organization/events"];
    expect(new Set(hrefs.map(getNavIcon)).size).toBe(hrefs.length);
  });
});
