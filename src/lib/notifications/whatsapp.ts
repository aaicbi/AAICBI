/**
 * WhatsApp, sent through Meta's WhatsApp Business Cloud API.
 *
 * This file used to be a placeholder because nothing here could be tested against Meta: it needs a verified
 * business, a registered sender number and Meta-approved message templates, none of which exist inside a coding
 * session. It is now a real implementation of Meta's documented "send a template message" call, and it is tested
 * against a stand-in server that answers the way Meta's API does. It has NOT been run against Meta itself: that
 * happens the first time real credentials are set. Until then it stays off.
 *
 * To turn it on, set in the environment:
 *   WHATSAPP_ENABLED="true"
 *   WHATSAPP_ACCESS_TOKEN        a permanent (system user) access token
 *   WHATSAPP_PHONE_NUMBER_ID     the sender's phone number id from Meta
 *   WHATSAPP_TEMPLATE_LANG       optional, the language code of the approved templates (default "en")
 *   WHATSAPP_API_BASE            optional, default https://graph.facebook.com/v20.0 (the stand-in server in tests)
 * and, for delivery receipts and STOP replies, the webhook settings read by /api/webhooks/whatsapp.
 *
 * Only template messages are sent. Meta only allows a business to start a conversation with an approved template,
 * so a free-form text would be refused outside a 24-hour customer-service window. Template variables are positional
 * ({{1}}, {{2}}, ...), passed here as a record whose keys are the positions.
 */
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

export function whatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true";
}

/** Enabled and holding the credentials a send needs. */
export function whatsAppConfigured(): boolean {
  return whatsAppEnabled() && !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
}

const SEND_TIMEOUT_MS = 10_000;

/** Positional variables in order: "1", "2", ... numerically when all keys are numbers, otherwise in the order given. */
function orderedParameters(variables: Record<string, string>) {
  const keys = Object.keys(variables);
  if (keys.every((k) => /^\d+$/.test(k))) keys.sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => ({ type: "text", text: String(variables[k]) }));
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  if (!whatsAppEnabled()) {
    return { ok: false, error: "WhatsApp is not enabled. Set WHATSAPP_ENABLED and the Meta credentials, see this file's comment." };
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required to send." };
  const to = input.to.replace(/\D/g, "");
  if (to.length < 7) return { ok: false, error: "That phone number is not valid." };

  const base = (process.env.WHATSAPP_API_BASE || "https://graph.facebook.com/v20.0").replace(/\/$/, "");
  const parameters = orderedParameters(input.variables);
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
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
