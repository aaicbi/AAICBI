/**
 * Pure helpers for the WhatsApp credentials a Super Admin pastes into the Growth page: sealing them for storage
 * (AES-256-GCM, key derived from the server's AUTH_SECRET) and checking what was pasted.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(`aaicbi:whatsapp-credentials:v1:${secret}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>", each part base64url. */
export function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

/** The original text, or null when the value is not ours, was changed, or was sealed with a different key. */
export function unseal(sealed: unknown, key: Buffer): string | null {
  if (typeof sealed !== "string") return null;
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Only the end of a secret is ever shown back, so the person can tell which one is saved. */
export function hintOf(secret: string): string {
  return secret.length <= 8 ? "••••" : `••••${secret.slice(-4)}`;
}

export interface CredentialInput { accessToken?: unknown; phoneNumberId?: unknown; appSecret?: unknown; verifyToken?: unknown; templateLang?: unknown }
export interface CleanCredentials { accessToken?: string; phoneNumberId?: string; appSecret?: string; verifyToken?: string; templateLang?: string }

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Leaves blank fields out (so a save never wipes what is already stored) and rejects anything that cannot be a real value. */
export function checkCredentials(input: CredentialInput): { ok: true; value: CleanCredentials } | { ok: false; error: string } {
  const out: CleanCredentials = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (!blank(input.accessToken)) {
    const t = str(input.accessToken);
    if (t.length < 20 || t.length > 600 || /\s/.test(t)) return { ok: false, error: "That access token does not look right. Copy it again from Meta, with no spaces." };
    out.accessToken = t;
  }
  if (!blank(input.phoneNumberId)) {
    const p = str(input.phoneNumberId);
    if (!/^\d{5,25}$/.test(p)) return { ok: false, error: "The phone number ID is digits only (not the phone number itself)." };
    out.phoneNumberId = p;
  }
  if (!blank(input.appSecret)) {
    const s = str(input.appSecret);
    if (s.length < 16 || s.length > 128 || /\s/.test(s)) return { ok: false, error: "That app secret does not look right. Copy it again from the Meta app's settings." };
    out.appSecret = s;
  }
  if (!blank(input.verifyToken)) {
    const v = str(input.verifyToken);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(v)) return { ok: false, error: "The verify token is 8 to 100 letters, numbers, dashes or underscores." };
    out.verifyToken = v;
  }
  if (!blank(input.templateLang)) {
    const l = str(input.templateLang);
    if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(l)) return { ok: false, error: "The template language looks like en or en_GB." };
    out.templateLang = l;
  }
  return { ok: true, value: out };
}

/** What has to be saved before WhatsApp can be switched on. */
export function missingForEnable(have: { accessToken: boolean; phoneNumberId: boolean; appSecret: boolean }): string[] {
  const out: string[] = [];
  if (!have.accessToken) out.push("the access token");
  if (!have.phoneNumberId) out.push("the phone number ID");
  if (!have.appSecret) out.push("the app secret (it checks delivery receipts and STOP replies are really from WhatsApp)");
  return out;
}
