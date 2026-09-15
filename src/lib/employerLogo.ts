/**
 * Universal profile system, Phase 6 — employer logo upload, copying
 * src/lib/avatar.ts's exact three-function shape (same image types and
 * size cap as an avatar — a logo has the same practical constraints).
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, same as avatar uploads

export function validateLogoFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Image must be under 5MB.";
  }
  return null;
}

export async function uploadLogo(file: File, pathPrefix: string): Promise<string> {
  // Bug fix — see lessonMaterial.ts's identical fix: no `contentType`
  // and no extension in the pathname meant Blob stored this as
  // application/octet-stream instead of the real image type.
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // addRandomSuffix explicit — @vercel/blob 1.0.0+ defaults this to
  // false; this app still wants unguessable, collision-proof URLs.
  const blob = await put(`logos/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

export async function deleteLogoBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete old logo blob:", err));
}
