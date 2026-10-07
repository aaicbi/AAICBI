import { describe, it, expect } from "vitest";
import { getAdminNavGroups } from "@/lib/admin/nav";

const labels = (role: string, org = false) => getAdminNavGroups(role, org).flatMap((g) => g.items.map((i) => i.label));

describe("getAdminNavGroups", () => {
  it("gives a super admin everything except the organization-only items", () => {
    const l = labels("SUPER_ADMIN");
    expect(l).toContain("Command Center");
    expect(l).toContain("Staff");
    expect(l).toContain("Training Organizations");
    expect(l).not.toContain("Overview");
    expect(l).not.toContain("Team");
    expect(l).not.toContain("Certificates");
  });

  it("keeps Command Center and Staff away from a plain admin", () => {
    const l = labels("ADMIN");
    expect(l).not.toContain("Command Center");
    expect(l).not.toContain("Staff");
    expect(l).toContain("Instructors");
  });

  it("keeps people and platform management away from an instructor", () => {
    const l = labels("INSTRUCTOR");
    expect(l).not.toContain("Instructors");
    expect(l).not.toContain("Training Organizations");
    expect(l).not.toContain("Showcase");
    expect(l).toContain("Courses");
    expect(l).toContain("Payments");
  });

  it("shows a training organization only its own scoped sections", () => {
    const l = labels("ADMIN", true);
    expect(l).toEqual(
      expect.arrayContaining(["Dashboard", "Courses", "Examinations", "Assignments", "Certificates", "Overview", "Team", "Performance", "Payments", "Settings"])
    );
    for (const hidden of ["Analytics", "Messages", "Showcase", "Training Organizations", "Instructors", "Staff", "Command Center", "Pitches", "Investors"]) {
      expect(l).not.toContain(hidden);
    }
  });

  it("never returns an empty group", () => {
    for (const [role, org] of [["SUPER_ADMIN", false], ["ADMIN", false], ["INSTRUCTOR", false], ["ADMIN", true]] as const) {
      for (const g of getAdminNavGroups(role, org)) expect(g.items.length).toBeGreaterThan(0);
    }
  });
});
