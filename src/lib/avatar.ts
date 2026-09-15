/**
 * M44 — Profile Picture Upload Infrastructure. The one genuinely new
 * kind of thing this app does: every other "media" field in this
 * schema (lesson materials, videos) is a validated *link* to
 * something already hosted elsewhere, because this app never had
 * real upload infrastructure before. This is that infrastructure —
 * real files, actually stored by this app, via Vercel Blob (chosen
 * over S3 specifically because this app already deploys to Vercel;
 * no separate AWS account or credential set needed).
 *
 * Shared between the trainee and staff avatar routes rather than
 * duplicated — same validation rules, same upload/cleanup mechanics,
 * genuinely identical for both, just applied to a different Prisma
 * model at the call site.
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — generous for a profile picture, not for an arbitrary file

/** Pure — no network, no filesystem — so this is genuinely unit
 * testable on its own, the same discipline as every other real
 * decision function elsewhere in this project. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Image must be under 5MB.";
  }
  return null;
}

export async function uploadAvatar(file: File, pathPrefix: string): Promise<string> {
  // Bug fix — see lessonMaterial.ts's identical fix for the full
  // reasoning: neither an explicit `contentType` nor a file extension
  // in the pathname was ever passed to `put()`, so Blob stored this as
  // application/octet-stream instead of the real image type. Avatars
  // are usually rendered via <img>, which many browsers still decode
  // regardless of Content-Type, but an avatar opened directly (e.g. a
  // trainee's own "view full size" link) would otherwise force-
  // download it with an extensionless, unreadable filename exactly
  // like the reported lesson-material bug did.
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // addRandomSuffix explicit — the SDK's own default flipped to false
  // in @vercel/blob 1.0.0, but this app still wants it: two different
  // people uploading a file that happens to share a name shouldn't
  // collide, and it means the URL itself can't be guessed from a
  // predictable pattern.
  const blob = await put(`avatars/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

/** Best-effort — a failed cleanup here should never fail the request
 * that's actually replacing or removing someone's avatar. Worst case
 * on failure is one orphaned blob sitting in storage, not a broken
 * user-facing action. */
export async function deleteAvatarBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete old avatar blob:", err));
}
