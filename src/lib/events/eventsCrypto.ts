import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Meeting passcodes are encrypted at rest (AES-256-GCM) with a key derived from the platform's own secret, so a database export or a
 * stray query does not show them. They are decrypted only when a person who may join asks for the joining details.
 */
const key = (): Buffer => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or too short to protect meeting passcodes.");
  return createHash("sha256").update(`aaicbi-events-passcode:${s}`).digest();
};

/** "v1.iv.tag.cipher", each part base64url. */
export function encryptPasscode(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

/** The passcode, or null when the stored text is missing or was not written by encryptPasscode (never throws). */
export function decryptPasscode(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, data] = stored.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
  } catch { return null; }
}
