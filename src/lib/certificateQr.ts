/**
 * M15 — QR code generation for a certificate's verification URL.
 * Server-side, offline, no external API call (the `qrcode` package
 * draws the code itself from the data — nothing to configure, no
 * rate limit, no third-party dependency beyond the npm package).
 * Returns an inline SVG string, not a PNG — scales cleanly at any
 * print size (a real consideration for something that might end up on
 * a printed certificate) and needs no image file to manage.
 */
import QRCode from "qrcode";

export async function certificateQrCodeSvg(verificationUrl: string): Promise<string> {
  return QRCode.toString(verificationUrl, {
    type: "svg",
    margin: 1,
    color: { dark: "#016B61", light: "#00000000" }, // brand teal on transparent
  });
}
