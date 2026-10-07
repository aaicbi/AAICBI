import { z } from "zod";

/** Pure rules for education posts — no database access, so they are unit-testable. */

export const EDUCATION_POST_STATUSES = ["AWAITING_CONSENT", "DECLINED", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "REMOVED"] as const;
export type EducationPostStatusValue = (typeof EDUCATION_POST_STATUSES)[number];

export const CreateEducationPostSchema = z.object({
  traineeId: z.string().min(1, "Choose a trainee."),
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(140),
  youtubeUrl: z.string().trim().min(1, "Paste the YouTube link."),
  description: z.string().trim().max(1000).optional().default(""),
  courseId: z.string().min(1).optional().nullable(),
  moduleName: z.string().trim().max(120).optional().default(""),
  category: z.string().trim().max(60).optional().default(""),
  skills: z.array(z.string().trim().min(1).max(40)).max(8).optional().default([]),
});
export type CreateEducationPostInput = z.infer<typeof CreateEducationPostSchema>;

/**
 * What happens when the featured trainee answers the consent request.
 * A verified organization's posts go live straight away; any other
 * organization's wait for SUPER_ADMIN review ("Trusted" moderation).
 */
export function statusAfterConsent(granted: boolean, orgVerified: boolean): EducationPostStatusValue {
  if (!granted) return "DECLINED";
  return orgVerified ? "PUBLISHED" : "PENDING_REVIEW";
}

/** Only these transitions are allowed for a SUPER_ADMIN moderation action. */
export function statusAfterModeration(
  current: EducationPostStatusValue,
  action: "approve" | "reject" | "remove"
): EducationPostStatusValue | null {
  if (action === "remove") return current === "REMOVED" ? null : "REMOVED";
  if (current !== "PENDING_REVIEW") return null;
  return action === "approve" ? "PUBLISHED" : "REJECTED";
}

/** Public visibility: published and nothing else. */
export function isPubliclyVisible(status: EducationPostStatusValue): boolean {
  return status === "PUBLISHED";
}

/** Lowercase, hyphenated, ascii-only; used for organization URLs. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "organization";
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalizes free-text skills: trimmed, de-duplicated case-insensitively. */
export function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const t = s.trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
