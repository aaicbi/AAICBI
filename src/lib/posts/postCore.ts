import { z } from "zod";

/**
 * Post rules with no database, so they can be tested: what a post may contain,
 * which status changes are allowed, when an edit needs a new review, and the
 * one test of whether anyone may see a post. That last test is used by every
 * place that shows posts (permalink, feeds, search, profiles), so unreviewed,
 * rejected, suspended or organization-blocked posts can never leak through one
 * path while another hides them.
 */
export const LIMITS = { body: 2000, title: 120, images: 6, alt: 200, tags: 10 } as const;

export type PostStatus = "DRAFT" | "PENDING_REVIEW" | "CHANGES_REQUESTED" | "PUBLISHED" | "REJECTED" | "SUSPENDED";
export type PostType = "TEXT" | "IMAGE" | "YOUTUBE";
export type Visibility = "PUBLIC" | "MEMBERS";

export const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Waiting for review",
  CHANGES_REQUESTED: "Changes requested",
  PUBLISHED: "Published",
  REJECTED: "Not approved",
  SUSPENDED: "Taken down",
};

const imageUrl = z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/i, "Image links must be secure web addresses.");

export const PostInputSchema = z.object({
  title: z.string().trim().max(LIMITS.title).optional().transform((v) => v || null),
  body: z.string().max(LIMITS.body * 2).default("").transform((v) => v.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()),
  youtubeUrl: z.string().trim().max(300).optional().transform((v) => v || null),
  images: z.array(z.object({ url: imageUrl, alt: z.string().trim().max(LIMITS.alt).optional().transform((v) => v || null) })).max(LIMITS.images, `A post can have up to ${LIMITS.images} images.`).default([]),
  visibility: z.enum(["PUBLIC", "MEMBERS"]).default("PUBLIC"),
}).superRefine((v, ctx) => {
  if (v.body.length > LIMITS.body) ctx.addIssue({ code: "custom", path: ["body"], message: `Please keep the post under ${LIMITS.body} characters.` });
  if (v.youtubeUrl && v.images.length > 0) ctx.addIssue({ code: "custom", path: ["youtubeUrl"], message: "A post can have a YouTube video or images, not both." });
  if (!v.body && !v.youtubeUrl && v.images.length === 0) ctx.addIssue({ code: "custom", path: ["body"], message: "Write something, add images, or add a YouTube link." });
});
export type PostInput = z.infer<typeof PostInputSchema>;

export function typeOf(input: { youtubeUrl: string | null; images: unknown[] }): PostType {
  if (input.youtubeUrl) return "YOUTUBE";
  return input.images.length > 0 ? "IMAGE" : "TEXT";
}

/** #topics in the text: lowercase, 2 to 30 letters, numbers or underscores, no repeats. */
export function extractTags(body: string): string[] {
  const found = body.match(/(^|[\s(])#([\p{L}\p{N}_]{2,30})/gu) ?? [];
  return [...new Set(found.map((m) => m.trim().replace(/^\(?#/, "").toLowerCase()))].slice(0, LIMITS.tags);
}

type Snapshot = { title: string | null; body: string; youtubeId: string | null; images: string[] };
const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** A change that readers would notice. Visibility alone is not material; wording, pictures and the video are. */
export function isMaterialEdit(before: Snapshot, after: Snapshot): boolean {
  return norm(before.title) !== norm(after.title) || norm(before.body) !== norm(after.body) || before.youtubeId !== after.youtubeId || before.images.join("|") !== after.images.join("|");
}

export const canEdit = (status: PostStatus) => status === "DRAFT" || status === "CHANGES_REQUESTED" || status === "PUBLISHED";
export const canSubmit = (status: PostStatus) => status === "DRAFT" || status === "CHANGES_REQUESTED";
export const canWithdraw = (status: PostStatus) => status === "PENDING_REVIEW";

/** Everyone except a super admin's own posts goes through review before it is public. */
export function needsReview(author: { isSuperAdmin: boolean }): boolean {
  return !author.isSuperAdmin;
}

/** What happens to a post when its author edits it. */
export function statusAfterEdit(status: PostStatus, material: boolean, skipsReview: boolean): PostStatus {
  if (status === "PUBLISHED" && material && !skipsReview) return "PENDING_REVIEW";
  return status;
}

export type ReviewAction = "approve" | "request_changes" | "reject" | "suspend" | "reinstate";
const FROM: Record<ReviewAction, PostStatus[]> = { approve: ["PENDING_REVIEW"], request_changes: ["PENDING_REVIEW"], reject: ["PENDING_REVIEW"], suspend: ["PUBLISHED"], reinstate: ["SUSPENDED"] };
const TO: Record<ReviewAction, PostStatus> = { approve: "PUBLISHED", request_changes: "CHANGES_REQUESTED", reject: "REJECTED", suspend: "SUSPENDED", reinstate: "PUBLISHED" };
export const REVIEW_LOG_ACTION: Record<ReviewAction, string> = { approve: "APPROVED", request_changes: "CHANGES_REQUESTED", reject: "REJECTED", suspend: "SUSPENDED", reinstate: "REINSTATED" };

/** A reviewer's decision. Anything but approving needs a reason the author will read. */
export function nextStatus(current: PostStatus, action: ReviewAction, note: string | null): { ok: true; status: PostStatus } | { ok: false; error: string; code: "reason" | "state" } {
  if (!FROM[action].includes(current)) return { ok: false, error: "That action does not fit the post's current status.", code: "state" };
  if (action !== "approve" && action !== "reinstate" && (!note || note.trim().length < 5)) return { ok: false, error: "Give a reason the author can read.", code: "reason" };
  return { ok: true, status: TO[action] };
}

/**
 * The single answer to "may this person see this post". Signed-out visitors
 * see only published, public, unblocked posts; signed-in people also see posts
 * limited to members. The author's side and reviewers see more elsewhere
 * (their own pages); this function is only the public rule.
 */
export function isPubliclyVisible(post: { status: string; orgBlockedAt: Date | null; visibility: string }, viewer: { signedIn: boolean }): boolean {
  if (post.status !== "PUBLISHED" || post.orgBlockedAt) return false;
  return post.visibility === "PUBLIC" || viewer.signedIn;
}
