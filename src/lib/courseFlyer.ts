/**
 * Course catalogue upgrade — flyer image upload, copying
 * src/lib/avatar.ts's exact three-function shape (validate/upload/
 * delete-best-effort). A slightly larger size cap than an avatar's
 * 5MB — a promotional flyer graphic reasonably runs larger than a
 * profile picture.
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export function validateFlyerFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Image must be under 8MB.";
  }
  return null;
}

export async function uploadFlyer(file: File, pathPrefix: string): Promise<string> {
  // Bug fix — see lessonMaterial.ts's identical fix: no `contentType`
  // and no extension in the pathname meant Blob stored this as
  // application/octet-stream instead of the real image type.
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // addRandomSuffix explicit — @vercel/blob 1.0.0+ defaults this to
  // false; this app still wants unguessable, collision-proof URLs.
  const blob = await put(`course-flyers/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

export async function deleteFlyerBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete old course flyer blob:", err));
}
