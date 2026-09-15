/**
 * Job posting media upload — copies src/lib/avatar.ts's exact
 * validate/upload/delete-best-effort shape, extended to accept EITHER
 * an image or a short video, each with its own type allow-list and
 * size cap (a video is legitimately larger than a photo, but this is
 * "a short promotional clip," not an arbitrary upload — capped well
 * below what would strain the platform).
 */
import { put, del } from "@vercel/blob";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB, same as avatar/logo uploads
const VIDEO_MAX_BYTES = 20 * 1024 * 1024; // 20MB — a short promotional clip, not a full production video

// A posting illustrated by 30 photos isn't "media to make the advert
// engaging," it's a gallery dump — capped to keep this a curated
// highlight, not an unbounded upload.
export const MAX_MEDIA_PER_POSTING = 5;

export type JobPostingMediaKind = "IMAGE" | "VIDEO";

/** Pure — no network, no filesystem — same testability discipline as validateAvatarFile. */
export function validateJobPostingMediaFile(file: { type: string; size: number }): { type: JobPostingMediaKind } | { error: string } {
  if (IMAGE_TYPES.includes(file.type)) {
    if (file.size > IMAGE_MAX_BYTES) return { error: "Images must be under 5MB." };
    return { type: "IMAGE" };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > VIDEO_MAX_BYTES) return { error: "Videos must be under 20MB." };
    return { type: "VIDEO" };
  }
  return { error: "Only JPG, PNG, WEBP images or MP4/WEBM videos are allowed." };
}

export async function uploadJobPostingMedia(file: File, pathPrefix: string): Promise<string> {
  // Bug fix — see lessonMaterial.ts's identical fix: no `contentType`
  // and no extension in the pathname meant Blob stored this as
  // application/octet-stream instead of the real image/video type —
  // for the VIDEO case specifically, that would have kept an
  // <video>/<source> element from recognising and playing it at all,
  // not just made a direct link download oddly.
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // addRandomSuffix explicit — @vercel/blob 1.0.0+ defaults this to
  // false; this app still wants unguessable, collision-proof URLs.
  const blob = await put(`job-postings/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

/** Best-effort — same reasoning as deleteAvatarBestEffort: a failed cleanup should never fail the request that's actually removing the media row. */
export async function deleteJobPostingMediaBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete job posting media blob:", err));
}
