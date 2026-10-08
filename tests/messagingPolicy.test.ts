import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { conversationPath, employerPairVerdict, newMessageNotice, traineeToEmployerVerdict } from "@/lib/messaging/policy";
import { filterInbox, shortTime, sortInbox, type InboxRow } from "@/lib/messaging/inboxCore";
import { getAdminNavGroups } from "@/lib/admin/nav";
import { EMPLOYER_NAV } from "@/lib/employer/nav";
import { buildPushPayload } from "@/lib/push/core";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("employer messaging rules", () => {
  it("lets an employer message a trainee only after the trainee engaged", () => {
    expect(employerPairVerdict("TRAINEE", {}).ok).toBe(false);
    expect(employerPairVerdict("TRAINEE", { acceptedIntroduction: true }).ok).toBe(true);
    expect(employerPairVerdict("TRAINEE", { appliedToEmployer: true }).ok).toBe(true);
  });
  it("lets an employer reach a Super Admin but no other staff, and never another employer", () => {
    expect(employerPairVerdict("STAFF", { staffIsSuperAdmin: true }).ok).toBe(true);
    expect(employerPairVerdict("STAFF", { staffIsSuperAdmin: false }).ok).toBe(false);
    expect(employerPairVerdict("EMPLOYER", {}).ok).toBe(false);
  });
  it("applies the same test from the trainee's side", () => {
    expect(traineeToEmployerVerdict({}).ok).toBe(false);
    expect(traineeToEmployerVerdict({ acceptedIntroduction: true }).ok).toBe(true);
    expect(traineeToEmployerVerdict({ appliedToEmployer: true }).ok).toBe(true);
  });
  it("sends each person to their own messages page", () => {
    expect(conversationPath("TRAINEE", "c1")).toBe("/trainee/messages/c1");
    expect(conversationPath("EMPLOYER", "c1")).toBe("/employer/messages/c1");
    expect(conversationPath("STAFF", "c1")).toBe("/admin/messages/c1");
  });
  it("a new-message notice never contains the message, and its push is private too", () => {
    const n = newMessageNotice("Ada Obi");
    expect(n.title).toBe("New message from Ada Obi");
    expect(n.body).not.toMatch(/hello|password/i);
    expect(buildPushPayload({ type: "NEW_MESSAGE", ...n, url: "/trainee/messages/c1" }).body).toBe("Open the app to read it.");
    expect(newMessageNotice("  ").title).toBe("New message from Someone");
  });
});

describe("the routes apply those rules", () => {
  it("every conversation route admits employers, and the direct route uses the policy", () => {
    for (const r of ["route.ts", "direct/route.ts", "contacts/route.ts", "block/route.ts", "[id]/messages/route.ts"]) {
      expect(read(`src/app/api/conversations/${r}`), r).toMatch(/requireRole\("TRAINEE", "EMPLOYER"/);
    }
    const direct = read("src/app/api/conversations/direct/route.ts");
    expect(direct).toMatch(/employerPairVerdict/);
    expect(direct).toMatch(/traineeToEmployerVerdict/);
  });
  it("an employer's inbox and contacts are limited to what they may reach", () => {
    expect(read("src/app/api/conversations/route.ts")).toMatch(/participantType: "EMPLOYER", participantId: session\.userId/);
    const contacts = read("src/app/api/conversations/contacts/route.ts");
    expect(contacts).toMatch(/status: "ACCEPTED"/);
    expect(contacts).toMatch(/jobPosting: \{ employerId: session\.userId \}/);
  });
  it("an organization's access stays limited to its own cohorts and conversations", () => {
    const list = read("src/app/api/conversations/route.ts");
    expect(list).toMatch(/cohort: \{ course: \{ createdById: session\.userId \} \}/);
    const contacts = read("src/app/api/conversations/contacts/route.ts");
    expect(contacts).toMatch(/cohort: \{ course: \{ createdById: session\.userId \} \}/);
    expect(read("src/app/api/conversations/direct/route.ts")).toMatch(/findTrainingOrgByStaffUserId/);
  });
  it("a sent message notifies the other person in a direct chat, but not a whole cohort", () => {
    const send = read("src/app/api/conversations/[id]/messages/route.ts");
    expect(send).toMatch(/notifyNewDirectMessage/);
    expect(send).toMatch(/conversation\.type === "DIRECT"/);
  });
});

describe("messages are reachable in the menus", () => {
  it("organizations and employers both have Messages", () => {
    const orgItems = getAdminNavGroups("ADMIN", true).flatMap((g) => g.items).map((i) => i.href);
    expect(orgItems).toContain("/admin/messages");
    expect(EMPLOYER_NAV.map((i) => i.href)).toContain("/employer/messages");
  });
});

describe("the inbox", () => {
  const row = (id: string, title: string, unread: number, at: string | null, body = "hi"): InboxRow => ({ id, type: "DIRECT", title, subtitle: null, unreadCount: unread, lastMessage: at ? { body, createdAt: at } : null });
  const rows = [row("a", "Ada", 0, "2026-10-10T10:00:00Z"), row("b", "Bola", 2, "2026-10-09T10:00:00Z"), row("c", "Chidi", 0, "2026-10-11T10:00:00Z", "see you at the open day")];
  it("shows unread first, then newest", () => expect(sortInbox(rows).map((r) => r.id)).toEqual(["b", "c", "a"]));
  it("searches names and message text", () => {
    expect(filterInbox(rows, "ada").map((r) => r.id)).toEqual(["a"]);
    expect(filterInbox(rows, "open day").map((r) => r.id)).toEqual(["c"]);
    expect(filterInbox(rows, "  ").length).toBe(3);
  });
  it("labels time the way chat apps do", () => {
    const now = new Date(2026, 9, 11, 15, 0, 0);
    expect(shortTime(new Date(2026, 9, 11, 14, 59, 40).toISOString(), now)).toBe("now");
    expect(shortTime(new Date(2026, 9, 11, 14, 48, 0).toISOString(), now)).toBe("12m");
    expect(shortTime(new Date(2026, 9, 11, 12, 0, 0).toISOString(), now)).toBe("3h");
    expect(shortTime(new Date(2026, 9, 10, 18, 0, 0).toISOString(), now)).toBe("Yesterday");
    expect(shortTime(new Date(2026, 9, 1, 9, 0, 0).toISOString(), now)).toMatch(/1 Oct/);
    expect(shortTime("not a date", now)).toBe("");
  });
});
