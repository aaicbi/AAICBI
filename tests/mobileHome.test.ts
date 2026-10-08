import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_ORDER, eventWhen, orderBlocks, type MobileBlock } from "@/lib/mobile/homeCore";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const b = {
  welcome: { kind: "welcome", greeting: "Good morning", name: "Ada", line: null },
  alerts: { kind: "alerts", unread: 2, items: [] },
  event: { kind: "event", title: "Open day", when: "x", where: null, by: "Org", href: "/events" },
  course: { kind: "course", title: "SQL", percent: 40, detail: "", href: "/x" },
  assessment: { kind: "assessment", title: "Quiz", status: "Start", href: "/y" },
  messages: { kind: "messages", href: "/trainee/messages" },
  opportunities: { kind: "opportunities", items: [], seeAllHref: "/jobs" },
  talent: { kind: "talent", text: "t", label: "l", href: "/h" },
  applications: { kind: "applications", count: 3, href: "/a" },
  trainees: { kind: "trainees", stats: [], href: "/t" },
  training: { kind: "training", stats: [], href: "/c" },
  actions: { kind: "actions", items: [] },
} satisfies Record<string, MobileBlock>;
const all = Object.values(b) as MobileBlock[];

describe("the phone home", () => {
  it("puts a trainee's most important things first, in the brief's order", () => {
    expect(orderBlocks("trainee", all).map((x) => x.kind)).toEqual(["welcome", "alerts", "event", "course", "assessment", "messages", "opportunities", "actions"]);
  });
  it("puts an employer's notifications and messages before talent, applications and events", () => {
    expect(orderBlocks("employer", all).map((x) => x.kind)).toEqual(["welcome", "alerts", "messages", "talent", "applications", "event", "opportunities", "actions"]);
  });
  it("shows an organization its notifications, trainee activity, messages, events and training", () => {
    expect(orderBlocks("organization", all).map((x) => x.kind)).toEqual(["welcome", "alerts", "trainees", "messages", "event", "training", "actions"]);
  });
  it("never shows a card that belongs to another account's home, and leaves out what is missing", () => {
    expect(orderBlocks("trainee", [b.talent, b.applications, b.welcome]).map((x) => x.kind)).toEqual(["welcome"]);
    for (const role of Object.keys(HOME_ORDER) as Array<keyof typeof HOME_ORDER>) expect(HOME_ORDER[role][0]).toBe("welcome");
  });
  it("says event times in UTC", () => {
    expect(eventWhen(new Date("2026-10-20T14:30:00Z"))).toMatch(/20 Oct.*14:30 UTC/);
  });
});

describe("the dashboards use it", () => {
  it("trainee, employer and organization homes show the short view on phones and the full page on laptops", () => {
    for (const [f, role] of [["src/app/trainee/dashboard/page.tsx", "trainee"], ["src/app/employer/dashboard/page.tsx", "employer"], ["src/app/admin/organization/page.tsx", "organization"]]) {
      const src = read(f);
      expect(src, f).toMatch(/<DashboardSwitcher mobile=\{<MobileHome role="/);
      expect(src, f).toContain(`role="${role}"`);
    }
  });
  it("the organization's phone home reads its own bell, not the staff one", () => {
    expect(read("src/app/admin/organization/page.tsx")).toMatch(/getRecentNotifications\("TRAINING_ORG", org\.id/);
  });
});
