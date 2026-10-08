import { z } from "zod";
import type { EducationPostStatusValue } from "@/lib/ecosystem/educationPostCore";

/**
 * Rules for videos a trainee posts themselves, and for reports a trainee
 * makes about an organization. Pure functions, no database access.
 *
 * A trainee's video goes to their training organization first. If the
 * organization does not answer, or declines, the trainee may send it to
 * SUPER_ADMIN instead, or choose to send it there from the start.
 */

export const SubmitVideoSchema = z.object({
  trainingOrganizationId: z.string().min(1, "Choose the training organization this video belongs to."),
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(140),
  youtubeUrl: z.string().trim().min(1, "Paste the YouTube link."),
  description: z.string().trim().max(1000).optional().default(""),
  courseId: z.string().min(1).optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(40)).max(8).optional().default([]),
  sendTo: z.enum(["organization", "admin"]).default("organization"),
  /** Why it goes straight to SUPER_ADMIN; only used when sendTo is "admin". */
  reason: z.string().trim().max(500).optional().default(""),
});
export type SubmitVideoInput = z.infer<typeof SubmitVideoSchema>;

export const EscalateSchema = z.object({
  reason: z.string().trim().min(5, "Tell us briefly what went wrong (at least 5 characters).").max(500),
});

export const OrgDecisionSchema = z.object({
  action: z.enum(["approve", "decline"]),
  note: z.string().trim().max(500).optional().default(""),
});

/** Where a newly submitted video starts. */
export function statusAfterSubmission(sendTo: "organization" | "admin"): EducationPostStatusValue {
  return sendTo === "admin" ? "PENDING_REVIEW" : "AWAITING_ORG";
}

/**
 * What an organization's decision does. Only a video still waiting on the
 * organization can be decided. A verified organization publishes straight
 * away; any other organization's approved video still waits for SUPER_ADMIN
 * review, the same "Trusted" moderation every organization video gets.
 */
export function statusAfterOrgDecision(
  current: EducationPostStatusValue,
  action: "approve" | "decline",
  orgVerified: boolean,
): EducationPostStatusValue | null {
  if (current !== "AWAITING_ORG") return null;
  if (action === "decline") return "ORG_DECLINED";
  return orgVerified ? "PUBLISHED" : "PENDING_REVIEW";
}

/** A trainee may send a video to SUPER_ADMIN while the organization has not approved it, or after it declined. */
export function canEscalate(status: EducationPostStatusValue, submittedByTrainee: boolean): boolean {
  return submittedByTrainee && (status === "AWAITING_ORG" || status === "ORG_DECLINED");
}

/** A trainee may take their own submission back until it has been approved. */
export function canWithdraw(status: EducationPostStatusValue, submittedByTrainee: boolean): boolean {
  return submittedByTrainee && (status === "AWAITING_ORG" || status === "ORG_DECLINED" || status === "PENDING_REVIEW");
}

export const REPORT_CATEGORIES = [
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "DISCRIMINATION", label: "Discrimination" },
  { value: "UNFAIR_TREATMENT", label: "Unfair treatment or grading" },
  { value: "FRAUD_OR_PAYMENT", label: "Fraud or a payment problem" },
  { value: "SAFETY", label: "Safety concern" },
  { value: "OTHER", label: "Something else" },
] as const;
export const REPORT_CATEGORY_VALUES = REPORT_CATEGORIES.map((c) => c.value) as unknown as [string, ...string[]];

export const OrgReportSchema = z.object({
  trainingOrganizationId: z.string().min(1, "Choose the organization."),
  category: z.enum(REPORT_CATEGORY_VALUES),
  details: z.string().trim().min(20, "Please describe what happened in at least 20 characters.").max(2000),
});

export const ReportActionSchema = z.object({
  action: z.enum(["in_review", "resolve", "dismiss"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export function reportStatusForAction(action: "in_review" | "resolve" | "dismiss"): "IN_REVIEW" | "RESOLVED" | "DISMISSED" {
  return action === "in_review" ? "IN_REVIEW" : action === "resolve" ? "RESOLVED" : "DISMISSED";
}
