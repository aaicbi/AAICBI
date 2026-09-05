/**
 * M25 — Paystack webhook signature verification. Deliberately pure and
 * synchronous — no network, no database — so this is genuinely unit
 * testable on its own, the same discipline as every other real
 * decision function elsewhere in this project.
 *
 * Verified directly against Paystack's own current documentation
 * before writing this, not from memory — HMAC-SHA512 (not SHA256, the
 * single most common mistake in real-world integrations, per multiple
 * independent sources checked) of the RAW request body, keyed with the
 * account's actual secret key, not a separate "webhook secret."
 *
 * The raw-body requirement matters enough to repeat here: the caller
 * MUST pass the exact, unparsed request body text — never something
 * that's already been through `JSON.parse`/re-serialized, since any
 * difference in whitespace or key ordering changes the hash. This is
 * the single most commonly reported real-world Paystack integration
 * bug, caused by frameworks that parse the body before it can be read
 * raw.
 */
import { createHmac, timingSafeEqual } from "crypto";

export function verifyPaystackSignature(rawBody: string, signatureHeader: string | null, secretKey: string): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");

  // Timing-safe comparison, not a plain `===` — a naive string compare
  // leaks how many leading characters matched through response-time
  // differences, a real (if narrow) attack surface for anything
  // verifying a secret-derived value. `timingSafeEqual` requires equal-
  // length buffers, so length is checked first — an unequal length is
  // already a definite mismatch, safe to short-circuit on before
  // attempting the timing-safe comparison at all.
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signatureHeader, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
