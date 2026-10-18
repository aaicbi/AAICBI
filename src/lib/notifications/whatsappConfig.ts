/**
 * The WhatsApp Cloud API credentials and the on/off switch, read at the moment of use.
 *
 * A Super Admin pastes them into the Growth page; they are kept in the database, sealed with a key derived from AUTH_SECRET,
 * and never sent back to a browser (only the last four characters). The environment variables the first version read
 * (WHATSAPP_ENABLED, WHATSAPP_ACCESS_TOKEN, ...) still work as a fallback, but once the Growth page has saved a setting, its switch decides:
 * off there means off, whatever the environment says. The API address is read from the environment only, never from the database, so
 * a stored value can never point the access token at another host.
 */
import { prisma } from "@/lib/prisma";
import { keyFrom, unseal } from "@/lib/notifications/whatsappConfigCore";

export const WHATSAPP_SCOPE = "WHATSAPP";
export const DEFAULT_API_BASE = "https://graph.facebook.com/v20.0";

export interface WhatsAppConfig {
  enabled: boolean;
  accessToken: string | null;
  phoneNumberId: string | null;
  verifyToken: string | null;
  appSecret: string | null;
  templateLang: string;
  apiBase: string;
  source: "settings" | "environment" | "none";
}

/** The sealing key, or null when AUTH_SECRET is missing or too short to trust. */
export function sealingKey(): Buffer | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 32 ? keyFrom(s) : null;
}

export async function loadWhatsAppConfig(): Promise<WhatsAppConfig> {
  const key = sealingKey();
  let row: { enabled: boolean; config: unknown } | null = null;
  try {
    row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: WHATSAPP_SCOPE, scopeId: "" } }, select: { enabled: true, config: true } });
  } catch {
    row = null;
  }
  const c = ((row?.config ?? {}) as Record<string, unknown>);
  const stored = (name: string) => (key ? unseal(c[name], key) : null);
  const env = process.env;
  const accessToken = stored("accessToken") ?? (env.WHATSAPP_ACCESS_TOKEN || null);
  const phoneNumberId = (typeof c.phoneNumberId === "string" && c.phoneNumberId) || env.WHATSAPP_PHONE_NUMBER_ID || null;
  const appSecret = stored("appSecret") ?? (env.WHATSAPP_APP_SECRET || null);
  const verifyToken = stored("verifyToken") ?? (env.WHATSAPP_VERIFY_TOKEN || null);
  const hasStored = !!(stored("accessToken") || c.phoneNumberId || stored("appSecret"));
  return {
    enabled: row ? row.enabled : env.WHATSAPP_ENABLED === "true",
    accessToken, phoneNumberId, verifyToken, appSecret,
    templateLang: (typeof c.templateLang === "string" && c.templateLang) || env.WHATSAPP_TEMPLATE_LANG || "en",
    apiBase: (env.WHATSAPP_API_BASE || DEFAULT_API_BASE).replace(/\/$/, ""),
    source: hasStored ? "settings" : accessToken || phoneNumberId ? "environment" : "none",
  };
}
