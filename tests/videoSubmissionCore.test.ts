import { describe, expect, it } from "vitest";
import {
  OrgReportSchema, SubmitVideoSchema, canEscalate, canWithdraw, reportStatusForAction, statusAfterOrgDecision, statusAfterSubmission,
} from "@/lib/ecosystem/videoSubmissionCore";
import { statusAfterModeration } from "@/lib/ecosystem/educationPostCore";

describe("trainee video submissions", () => {
  it("start with the organization, or with SUPER_ADMIN when the trainee chooses that", () => {
    expect(statusAfterSubmission("organization")).toBe("AWAITING_ORG");
    expect(statusAfterSubmission("admin")).toBe("PENDING_REVIEW");
  });

  it("let only a video waiting on the organization be decided", () => {
    expect(statusAfterOrgDecision("AWAITING_ORG", "approve", true)).toBe("PUBLISHED");
    expect(statusAfterOrgDecision("AWAITING_ORG", "approve", false)).toBe("PENDING_REVIEW");
    expect(statusAfterOrgDecision("AWAITING_ORG", "decline", true)).toBe("ORG_DECLINED");
    for (const s of ["PUBLISHED", "PENDING_REVIEW", "ORG_DECLINED", "REMOVED", "AWAITING_CONSENT"] as const) {
      expect(statusAfterOrgDecision(s, "approve", true), s).toBeNull();
    }
  });

  it("allow escalation only for the trainee's own video the organization has not approved", () => {
    expect(canEscalate("AWAITING_ORG", true)).toBe(true);
    expect(canEscalate("ORG_DECLINED", true)).toBe(true);
    expect(canEscalate("AWAITING_ORG", false)).toBe(false);
    for (const s of ["PUBLISHED", "PENDING_REVIEW", "REMOVED", "REJECTED"] as const) expect(canEscalate(s, true), s).toBe(false);
  });

  it("allow withdrawing until it is approved", () => {
    expect(canWithdraw("PENDING_REVIEW", true)).toBe(true);
    expect(canWithdraw("PUBLISHED", true)).toBe(false);
    expect(canWithdraw("AWAITING_ORG", false)).toBe(false);
  });

  it("feed an escalated video into the existing SUPER_ADMIN review", () => {
    expect(statusAfterModeration("PENDING_REVIEW", "approve")).toBe("PUBLISHED");
    expect(statusAfterModeration("AWAITING_ORG", "approve")).toBeNull();
  });

  it("validates a submission", () => {
    const ok = SubmitVideoSchema.safeParse({ trainingOrganizationId: "o1", title: "My project demo", youtubeUrl: "https://youtu.be/abc" });
    expect(ok.success && ok.data.sendTo).toBe("organization");
    expect(SubmitVideoSchema.safeParse({ trainingOrganizationId: "", title: "x", youtubeUrl: "" }).success).toBe(false);
  });
});

describe("reports about an organization", () => {
  it("need a real category and enough detail", () => {
    expect(OrgReportSchema.safeParse({ trainingOrganizationId: "o1", category: "HARASSMENT", details: "x".repeat(20) }).success).toBe(true);
    expect(OrgReportSchema.safeParse({ trainingOrganizationId: "o1", category: "HARASSMENT", details: "too short" }).success).toBe(false);
    expect(OrgReportSchema.safeParse({ trainingOrganizationId: "o1", category: "NOPE", details: "x".repeat(30) }).success).toBe(false);
  });
  it("maps actions to statuses", () => {
    expect(reportStatusForAction("in_review")).toBe("IN_REVIEW");
    expect(reportStatusForAction("resolve")).toBe("RESOLVED");
    expect(reportStatusForAction("dismiss")).toBe("DISMISSED");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { answerQuestion, buildIndex } from "@/lib/guide/match";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";
import { entriesForAudience, playbookEntries } from "@/lib/guide/playbooks";

describe("who may call the new routes", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("trainee routes require a trainee, and the report review requires SUPER_ADMIN", () => {
    for (const r of [
      "src/app/api/trainee/videos/route.ts",
      "src/app/api/trainee/videos/[id]/route.ts",
      "src/app/api/trainee/videos/[id]/escalate/route.ts",
      "src/app/api/trainee/org-reports/route.ts",
    ]) expect(read(r), r).toMatch(/requireRole\("TRAINEE"\)/);
    expect(read("src/app/api/admin/ecosystem/reports/[id]/route.ts")).toMatch(/requireRole\("SUPER_ADMIN"\)/);
    expect(read("src/app/api/org/education-posts/[id]/decision/route.ts")).toMatch(/requireTrainingOrgSession/);
  });
  it("never reveal the reporter to an organization", () => {
    for (const r of ["src/app/api/org/education-posts/route.ts", "src/app/api/org/education-posts/[id]/decision/route.ts", "src/app/api/org/insights/route.ts"]) {
      expect(read(r), r).not.toMatch(/organizationReport/);
    }
  });
  it("only lets a trainee act on their own videos", () => {
    expect(read("src/app/api/trainee/videos/[id]/escalate/route.ts")).toMatch(/traineeId: session\.userId/);
    expect(read("src/app/api/trainee/videos/[id]/route.ts")).toMatch(/traineeId: session\.userId/);
  });
});

describe("Loop knows the new trainee routes", () => {
  it("finds the guides for exploring, posting a video and reporting", () => {
    const index = buildIndex(entriesForAudience([...DEFAULT_ENTRIES, ...playbookEntries()], "trainee"), []);
    const on = { orgPages: true, education: true, feed: true, publicJobs: true, publicTrainees: true };
    const cases: Record<string, string> = {
      "how do i explore the ecosystem and see job listings": "trainee-explore",
      "how do i post my video to my training organization": "trainee-video",
      "how do i send my video to the super admin": "trainee-video",
      "how do i report an abusive training organization": "trainee-report",
      "i want to report harassment by an organization": "trainee-report",
    };
    for (const [q, id] of Object.entries(cases)) expect(answerQuestion(q, index, on).playbookId, q).toBe(id);
  });
});
