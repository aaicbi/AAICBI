/**
 * Visual Certificate Design Editor — upload helper for the shared icon
 * bank (CertificateIcon). Same validate/upload/delete-best-effort
 * shape as certificateTemplateLogo.ts, extended to also allow SVG:
 * safe here specifically because every render path that consumes an
 * uploaded icon only ever loads it as an image resource (`<img src>`
 * / Fabric's FabricImage), never inlines it via dangerouslySetInnerHTML
 * — a browser runs an SVG loaded through `<img>` in "image mode,"
 * which never executes embedded <script> or event-handler content.
 */
import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — an icon, not a photo

export function validateCertificateIconFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only PNG, JPG, WEBP, or SVG images are allowed.";
  if (file.size > MAX_SIZE_BYTES) return "Icon must be under 2MB.";
  return null;
}

export async function uploadCertificateIcon(file: File, pathPrefix: string): Promise<string> {
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const blob = await put(`certificate-icons/${pathPrefix}-${Date.now()}${extension}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

export async function deleteCertificateIconBestEffort(url: string): Promise<void> {
  await del(url).catch((err) => console.error("Failed to delete certificate icon blob:", err));
}
