/**
 * WhatsApp, sent through Meta's WhatsApp Business Cloud API.
 *
 * It needs a verified business, a registered sender number and Meta-approved message templates. The credentials and the
 * on/off switch are kept by a Super Admin on the Growth page (see whatsappConfig.ts); it stays off until they switch it on.
 * It is tested against a stand-in server that answers the way Meta's API does, and has NOT been run against Meta itself:
 * that happens the first time real credentials are saved and "Test connection" is pressed.
 *
 * Only template messages are sent. Meta only allows a business to start a conversation with an approved template,
 * so a free-form text would be refused outside a 24-hour customer-service window. Template variables are positional
 * ({{1}}, {{2}}, ...), passed here as a record whose keys are the positions.
 */
import { loadWhatsAppConfig } from "@/lib/notifications/whatsappConfig";

export interface SendWhatsAppInput {
  to: string; // E.164 phone number
  templateName: string;
  variables: Record<string, string>;
}

export interface SendWhatsAppResult {
  ok: boolean;
  error?: string;
  /** Meta's id for the message, used to match delivery receipts. */
  messageId?: string;
}

export async function whatsAppEnabled(): Promise<boolean> {
  return (await loadWhatsAppConfig()).enabled;
}

/** Switched on and holding the credentials a send needs. */
export async function whatsAppConfigured(): Promise<boolean> {
  const c = await loadWhatsAppConfig();
  return c.enabled && !!c.accessToken && !!c.phoneNumberId;
}

const SEND_TIMEOUT_MS = 10_000;

/** Positional variables in order: "1", "2", ... numerically when all keys are numbers, otherwise in the order given. */
function orderedParameters(variables: Record<string, string>) {
  const keys = Object.keys(variables);
  if (keys.every((k) => /^\d+$/.test(k))) keys.sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => ({ type: "text", text: String(variables[k]) }));
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const cfg = await loadWhatsAppConfig();
  if (!cfg.enabled) return { ok: false, error: "WhatsApp is switched off. A Super Admin turns it on from the Growth page." };
  const token = cfg.accessToken;
  const phoneId = cfg.phoneNumberId;
  if (!token || !phoneId) return { ok: false, error: "The WhatsApp access token and phone number ID are not saved yet." };
  const to = input.to.replace(/\D/g, "");
  if (to.length < 7) return { ok: false, error: "That phone number is not valid." };

  const base = cfg.apiBase;
  const parameters = orderedParameters(input.variables);
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: cfg.templateLang },
      ...(parameters.length ? { components: [{ type: "body", parameters }] } : {}),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { message?: string } } | null;
    if (!res.ok) return { ok: false, error: (json?.error?.message ?? `WhatsApp refused the message (${res.status}).`).slice(0, 200) };
    return { ok: true, messageId: json?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "WhatsApp did not answer in time." : "Could not reach WhatsApp." };
  } finally {
    clearTimeout(timer);
  }
}

export interface ConnectionResult { ok: boolean; error?: string; displayNumber?: string; verifiedName?: string }

/** Asks Meta who owns this phone number ID, using this token. Sends nothing, so it is safe to press at any time, even while switched off. */
export async function checkWhatsAppConnection(creds: { accessToken: string; phoneNumberId: string; apiBase: string }): Promise<ConnectionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${creds.apiBase}/${encodeURIComponent(creds.phoneNumberId)}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${creds.accessToken}` }, signal: controller.signal });
    const json = (await res.json().catch(() => null)) as { display_phone_number?: string; verified_name?: string; error?: { message?: string } } | null;
    if (!res.ok) return { ok: false, error: (json?.error?.message ?? `WhatsApp refused the check (${res.status}).`).slice(0, 200) };
    return { ok: true, displayNumber: json?.display_phone_number, verifiedName: json?.verified_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "WhatsApp did not answer in time." : "Could not reach WhatsApp." };
  } finally {
    clearTimeout(timer);
  }
}
