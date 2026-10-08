import { z } from "zod";
import { isSafeHref } from "@/lib/guide/links";

export const LinkSchema = z.object({
  label: z.string().trim().min(1, "Give each link a label.").max(60),
  href: z.string().refine(isSafeHref, "A link must be a path on this site, like /jobs."),
});

/** One written answer, as SUPER_ADMIN writes it. */
export const EntrySchema = z.object({
  question: z.string().trim().min(3, "Write the question.").max(200),
  answer: z.string().trim().min(10, "The answer is too short.").max(600, "Keep the answer under 600 characters."),
  links: z.array(LinkSchema).max(5).default([]),
  keywords: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  enabled: z.boolean().default(true),
});

export type EntryInput = z.infer<typeof EntrySchema>;

export const UnansweredAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer") }).merge(EntrySchema),
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("reopen") }),
]);
