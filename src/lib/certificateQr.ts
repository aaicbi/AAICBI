/**
 * M15 — QR code generation for a certificate's verification URL.
 * Server-side, offline, no external API call (the `qrcode` package
 * draws the code itself from the data — nothing to configure, no
 * rate limit, no third-party dependency beyond the npm package).
 *
 * A PNG data URI, not inline SVG — the visual certificate design
 * engine's QR "image" element renders it as a plain `<img src>` (both
 * in the read-only CertificateLayoutRenderer and, via FabricImage, in
 * the canvas editor), so there's no `dangerouslySetInnerHTML` needed
 * anywhere in the certificate rendering path.
 */
import QRCode from "qrcode";

export async function certificateQrCodeDataUrl(verificationUrl: string): Promise<string> {
  return QRCode.toDataURL(verificationUrl, {
    margin: 1,
    color: { dark: "#016B61", light: "#FFFFFF" },
  });
}
