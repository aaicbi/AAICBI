import { z } from "zod";

/**
 * Startup rules with no database, so they can be tested: what a startup
 * profile may contain, who on the team may do what, and which status changes
 * are allowed. A startup is public only after a super admin approves it, and
 * "verified" is a separate mark that only a person sets.
 */
export const STAGES = ["IDEA", "PROTOTYPE", "MVP", "LAUNCHED", "GROWTH"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = { IDEA: "Idea", PROTOTYPE: "Prototype", MVP: "Early product (MVP)", LAUNCHED: "Launched", GROWTH: "Growing" };

export const INDUSTRIES = ["AI and data", "Education", "Health", "Agriculture", "Finance and payments", "Commerce and logistics", "Energy and climate", "Media and creative", "Public sector and civic", "Developer tools", "Other"] as const;

export const SEEKING = ["FUNDING", "HIRING", "PARTNERS", "MENTORSHIP"] as const;
export type Seeking = (typeof SEEKING)[number];
export const SEEKING_LABEL: Record<Seeking, string> = { FUNDING: "Funding", HIRING: "Hiring", PARTNERS: "Partners", MENTORSHIP: "Mentorship" };

export const LIMITS = { name: 80, tagline: 120, problem: 1000, solution: 1000, description: 2000, traction: 600, fundingNeed: 600, location: 80, title: 60 } as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full web address starting with http:// or https://");

export const StartupInputSchema = z.object({
  name: z.string().trim().min(2, "Give the startup a name.").max(LIMITS.name),
  tagline: optionalText(LIMITS.tagline),
  problem: optionalText(LIMITS.problem),
  solution: optionalText(LIMITS.solution),
  description: optionalText(LIMITS.description),
  industry: z.enum(INDUSTRIES).optional().nullable().transform((v) => v ?? null),
  stage: z.enum(STAGES).default("IDEA"),
  location: optionalText(LIMITS.location),
  website: optionalUrl,
  traction: optionalText(LIMITS.traction),
  fundingNeed: optionalText(LIMITS.fundingNeed),
  seeking: z.array(z.enum(SEEKING)).max(SEEKING.length).default([]).transform((a) => [...new Set(a)]),
});
export type StartupInput = z.infer<typeof StartupInputSchema>;

/** What a startup needs before it can be sent for review. */
export function missingForSubmit(s: { tagline: string | null; problem: string | null; solution: string | null; industry: string | null }): string[] {
  const out: string[] = [];
  if (!s.tagline) out.push("a one-line tagline");
  if (!s.problem) out.push("the problem you solve");
  if (!s.solution) out.push("your solution");
  if (!s.industry) out.push("an industry");
  return out;
}

export type MemberLike = { role: "FOUNDER" | "MEMBER"; canEdit: boolean; canPublish: boolean; status: string };
export type Action = "view_private" | "edit" | "publish" | "manage_team" | "submit";

/** What a team member may do. Only active members count; founders may do everything. */
export function can(member: MemberLike | null | undefined, action: Action): boolean {
  if (!member || member.status !== "ACTIVE") return false;
  if (member.role === "FOUNDER") return true;
  if (action === "view_private") return true;
  if (action === "edit") return member.canEdit;
  if (action === "publish") return member.canPublish;
  return false;
}

export const isPublic = (status: string) => status === "APPROVED";
export const canSubmit = (status: string) => status === "DRAFT" || status === "REJECTED";

export type AdminAction = "approve" | "reject" | "suspend" | "reinstate";
const FROM: Record<AdminAction, string[]> = { approve: ["PENDING"], reject: ["PENDING"], suspend: ["APPROVED", "PENDING"], reinstate: ["SUSPENDED"] };
const TO: Record<AdminAction, string> = { approve: "APPROVED", reject: "REJECTED", suspend: "SUSPENDED", reinstate: "APPROVED" };

/** The status after an admin action, or an error when the action does not fit the current status. */
export function nextStatus(current: string, action: AdminAction, note: string | null): { ok: true; status: string } | { ok: false; error: string } {
  if (!FROM[action].includes(current)) return { ok: false, error: "That action does not fit the startup's current status." };
  if ((action === "reject" || action === "suspend") && (!note || note.trim().length < 5)) return { ok: false, error: "Give a reason so the team knows why." };
  return { ok: true, status: TO[action] };
}

/** The team must always keep at least one active founder. */
export function wouldLeaveNoFounder(members: Array<{ id: string; role: string; status: string }>, removingOrDemotingId: string): boolean {
  const others = members.filter((m) => m.id !== removingOrDemotingId && m.role === "FOUNDER" && m.status === "ACTIVE");
  return others.length === 0;
}
