/**
 * Community Showcase media upload — copies src/lib/jobPostingMedia.ts's
 * exact validate/upload/delete-best-effort shape (which itself copies
 * src/lib/avatar.ts's), same image/video allow-lists and size caps.
 */
import { put, del } from "@vercel/blob";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB, same as avatar/job-posting-media uploads
const VIDEO_MAX_BYTES = 20 * 1024 * 1024; // 20MB — a short clip, not a full production video

// Same reasoning as MAX_MEDIA_PER_POSTING — a curated highlight, not an
// unbounded gallery dump.
export const MAX_MEDIA_PER_PROJECT = 5;

export type ProjectMediaKind = "IMAGE" | "VIDEO";

/** Pure — no network, no filesystem — same testability discipline as validateAvatarFile/validateJobPostingMediaFile. */
export function validateProjectMediaFile(file: { type: string; size: number }): { type: ProjectMediaKind } | { error: string } {
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

export async function uploadProjectMedia(file: File, pathPrefix: string): Promise<string> {
  // Same contentType/extension bug-fix reasoning as uploadJobPostingMedia's
  // own comment — without it Blob stores this as application/octet-stream,
  // which keeps a <video>/<source> element from recognising a VIDEO at all.
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const blob = await put(`showcase/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

/** Best-effort — same reasoning as deleteJobPostingMediaBestEffort: a failed cleanup should never fail the request that's actually removing the media row. */
export async function deleteProjectMediaBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete project media blob:", err));
}
