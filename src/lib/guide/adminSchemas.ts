import { z } from "zod";
import { isSafeHref } from "@/lib/guide/links";

export const LinkSchema = z.object({
  label: z.string().trim().min(1, "Give each link a label.").max(60),
  href: z.string().refine(isSafeHref, "A link must be a path on this site, like /jobs."),
});

export const GUIDE_ROLES = ["trainee", "employer", "investor", "organization", "staff"] as const;

/** Suggested categories; any short text is allowed. */
export const GUIDE_CATEGORIES = ["Getting started", "Account and sign in", "Courses and learning", "Assessments and certificates", "Messaging", "Jobs and opportunities", "Organizations and teams", "Payments", "Videos and events", "Settings and privacy"];

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** One written answer, as SUPER_ADMIN writes or approves it. */
export const EntrySchema = z.object({
  question: z.string().trim().min(3, "Write the question.").max(200),
  answer: z.string().trim().min(10, "The answer is too short.").max(600, "Keep the answer under 600 characters."),
  links: z.array(LinkSchema).max(5).default([]),
  keywords: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  enabled: z.boolean().default(true),
  category: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()).transform((v) => v ?? null),
  /** Where the answer sends someone ("Take me there"). */
  navHref: z.preprocess(emptyToNull, z.string().trim().refine(isSafeHref, "The destination must be a path on this site, like /trainee/messages.").nullable().optional()).transform((v) => v ?? null),
  navLabel: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()).transform((v) => v ?? null),
  /** The control to light up ("Show me"): a data-guide-target id. */
  target: z.preprocess(emptyToNull, z.string().trim().regex(/^[A-Za-z0-9:_\-/.]{1,80}$/, "A target is letters, numbers and : _ - / . only.").nullable().optional()).transform((v) => v ?? null),
  relatedQuestions: z.array(z.string().trim().min(3).max(200)).max(8).default([]),
  /** Who the answer is for. Empty means everyone. */
  roles: z.array(z.enum(GUIDE_ROLES)).max(5).default([]),
  changeNote: z.string().trim().max(200).optional(),
});

export type EntryInput = z.infer<typeof EntrySchema>;

/**
 * What SUPER_ADMIN can do with a question Loop could not answer: write the
 * answer (approve it into the knowledge), take it into review, reject it,
 * merge it into another question or an existing answer, mark it resolved
 * without an answer (for example the page was fixed), or put it back.
 */
export const UnansweredAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer") }).merge(EntrySchema),
  z.object({ action: z.literal("review") }),
  z.object({ action: z.literal("reject"), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("merge"), intoQuestionId: z.string().min(1).optional(), intoEntryId: z.string().min(1).optional() }),
  z.object({ action: z.literal("resolve"), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("categorize"), category: z.string().trim().max(40) }),
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("reopen") }),
]).refine((v) => v.action !== "merge" || !!v.intoQuestionId !== !!v.intoEntryId, "Choose one thing to merge into.");
