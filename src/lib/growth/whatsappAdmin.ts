import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { checkWhatsAppConnection } from "@/lib/notifications/whatsapp";
import { WHATSAPP_SCOPE, loadWhatsAppConfig, sealingKey } from "@/lib/notifications/whatsappConfig";
import { checkCredentials, hintOf, missingForEnable, seal, type CredentialInput } from "@/lib/notifications/whatsappConfigCore";

export class WhatsAppAdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function audit(actorId: string, action: string, detail?: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType: WHATSAPP_SCOPE, scopeId: "", detail: detail?.slice(0, 300) ?? null } });
}

async function row() {
  return prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: WHATSAPP_SCOPE, scopeId: "" } } });
}

async function write(actorId: string, patch: { enabled?: boolean; config: Record<string, unknown> }, replaceConfig = false) {
  const current = await row();
  const config = replaceConfig ? patch.config : { ...((current?.config ?? {}) as Record<string, unknown>), ...patch.config };
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: WHATSAPP_SCOPE, scopeId: "" } },
    create: { scopeType: WHATSAPP_SCOPE, scopeId: "", enabled: patch.enabled ?? false, config: config as object, updatedById: actorId },
    update: { ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}), config: config as object, updatedById: actorId },
  });
}

/** What the screen may show: which pieces are saved and the end of the secret ones, never a secret itself. */
export async function whatsappStatus() {
  const [cfg, r] = await Promise.all([loadWhatsAppConfig(), row()]);
  const c = ((r?.config ?? {}) as Record<string, unknown>);
  return {
    enabled: cfg.enabled,
    source: cfg.source,
    canStoreSecrets: !!sealingKey(),
    accessToken: cfg.accessToken ? { set: true, hint: hintOf(cfg.accessToken) } : { set: false, hint: null },
    appSecret: cfg.appSecret ? { set: true, hint: hintOf(cfg.appSecret) } : { set: false, hint: null },
    phoneNumberId: cfg.phoneNumberId,
    // The verify token is what the person pastes into Meta, so it is shown in full. It only proves who is registering the webhook.
    verifyToken: cfg.verifyToken,
    templateLang: cfg.templateLang,
    webhookUrl: appUrl("/api/webhooks/whatsapp"),
    savedAt: r?.updatedAt?.toISOString() ?? null,
    missing: missingForEnable({ accessToken: !!cfg.accessToken, phoneNumberId: !!cfg.phoneNumberId, appSecret: !!cfg.appSecret }),
  };
}

export async function saveCredentials(actorId: string, input: CredentialInput) {
  const key = sealingKey();
  if (!key) throw new WhatsAppAdminError("This server's AUTH_SECRET is missing or too short, so credentials cannot be stored safely.", 503);
  const c = checkCredentials(input);
  if (!c.ok) throw new WhatsAppAdminError(c.error);
  const v = c.value;
  if (Object.keys(v).length === 0) throw new WhatsAppAdminError("Paste at least one value to save.");
  const config: Record<string, unknown> = {};
  if (v.accessToken) config.accessToken = seal(v.accessToken, key);
  if (v.appSecret) config.appSecret = seal(v.appSecret, key);
  if (v.verifyToken) config.verifyToken = seal(v.verifyToken, key);
  if (v.phoneNumberId) config.phoneNumberId = v.phoneNumberId;
  if (v.templateLang) config.templateLang = v.templateLang;
  await write(actorId, { config });
  // Names of what changed, never the values.
  await audit(actorId, "WHATSAPP_SAVED", Object.keys(v).join(", "));
}

/** A fresh random verify token, saved, for the person to paste into Meta. */
export async function generateVerifyToken(actorId: string) {
  const key = sealingKey();
  if (!key) throw new WhatsAppAdminError("This server's AUTH_SECRET is missing or too short, so credentials cannot be stored safely.", 503);
  await write(actorId, { config: { verifyToken: seal(randomBytes(24).toString("base64url"), key) } });
  await audit(actorId, "WHATSAPP_SAVED", "verifyToken (generated)");
}

export async function setWhatsAppEnabled(actorId: string, enabled: boolean) {
  if (enabled) {
    const cfg = await loadWhatsAppConfig();
    const missing = missingForEnable({ accessToken: !!cfg.accessToken, phoneNumberId: !!cfg.phoneNumberId, appSecret: !!cfg.appSecret });
    if (missing.length) throw new WhatsAppAdminError(`Save ${missing.join(", ")} first.`, 409);
    if (!cfg.verifyToken) await generateVerifyToken(actorId);
  }
  await write(actorId, { enabled, config: {} });
  await audit(actorId, enabled ? "WHATSAPP_ON" : "WHATSAPP_OFF");
}

/** Forgets every saved credential and switches WhatsApp off. */
export async function clearCredentials(actorId: string) {
  await write(actorId, { enabled: false, config: {} }, true);
  await audit(actorId, "WHATSAPP_CLEARED");
}

/** Checks the saved token and phone number ID with Meta. Sends nothing. */
export async function testWhatsApp() {
  const cfg = await loadWhatsAppConfig();
  if (!cfg.accessToken || !cfg.phoneNumberId) throw new WhatsAppAdminError("Save the access token and phone number ID first.", 409);
  return checkWhatsAppConnection({ accessToken: cfg.accessToken, phoneNumberId: cfg.phoneNumberId, apiBase: cfg.apiBase });
}
