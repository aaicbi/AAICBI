import { createHmac, timingSafeEqual } from "crypto";

/** Resend's delivery reports are signed with Svix. Kept apart from emailCore so the browser bundle never pulls in Node's crypto. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Checks a Resend/Svix webhook: the signature over `id.timestamp.body` with the shared secret, and that the timestamp is recent. */
export function verifyWebhook(i: { id: string | null; timestamp: string | null; signatureHeader: string | null; body: string; secret: string; nowMs?: number }): boolean {
  if (!i.id || !i.timestamp || !i.signatureHeader || !i.secret) return false;
  const ts = Number(i.timestamp);
  const now = Math.floor((i.nowMs ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(i.secret.startsWith("whsec_") ? i.secret.slice(6) : i.secret, "base64");
  const expected = createHmac("sha256", key).update(`${i.id}.${i.timestamp}.${i.body}`).digest();
  for (const part of i.signatureHeader.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}
