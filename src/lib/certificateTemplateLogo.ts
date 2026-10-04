/**
 * Training Organizations, Phase 1 — certificate template logo upload,
 * copying src/lib/employerLogo.ts's exact three-function shape (same
 * image types and size cap — a logo has the same practical
 * constraints regardless of which feature it's for).
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, same as avatar/employer-logo uploads

export function validateCertificateTemplateLogoFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Image must be under 5MB.";
  }
  return null;
}

export async function uploadCertificateTemplateLogo(file: File, pathPrefix: string): Promise<string> {
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const blob = await put(`certificate-template-logos/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

export async function deleteCertificateTemplateLogoBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete old certificate template logo blob:", err));
}
