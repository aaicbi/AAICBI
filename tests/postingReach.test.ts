import { describe, expect, it } from "vitest";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import { EMPLOYER_NAV } from "@/lib/employer/nav";
import { INVESTOR_NAV } from "@/lib/investor/nav";
import { INSTRUCTOR_NAV } from "@/lib/instructor/nav";
import { getAdminNavGroups } from "@/lib/admin/nav";

const hrefs = (items: Array<{ href: string }>) => items.map((i) => i.href);

describe("every kind of account can reach the feed and write a post from its own menu", () => {
  const lists: Record<string, string[]> = {
    trainee: hrefs(TRAINEE_NAV),
    employer: hrefs(EMPLOYER_NAV),
    investor: hrefs(INVESTOR_NAV),
    instructor: hrefs(INSTRUCTOR_NAV),
    staff: hrefs(getAdminNavGroups("ADMIN", false, false).flatMap((g) => g.items)),
    superAdmin: hrefs(getAdminNavGroups("SUPER_ADMIN", false, true).flatMap((g) => g.items)),
    organization: hrefs(getAdminNavGroups("ADMIN", true, false).flatMap((g) => g.items)),
  };
  for (const [who, list] of Object.entries(lists)) {
    it(`${who}: Feed, Write a post, My posts`, () => {
      expect(list).toEqual(expect.arrayContaining(["/feed", "/compose", "/my-posts"]));
    });
  }
});
