/**
 * M14 — WhatsApp, deliberately NOT implemented in this pass.
 *
 * The roadmap's own sizing for this milestone is explicit about why:
 * "M (WhatsApp, mostly integration/approval overhead not code
 * complexity)... don't let its API approval lead time block shipping
 * email first." Meta's WhatsApp Business API (or a BSP layer on top of
 * it like Twilio) requires a verified business, a real phone number
 * registered as a WhatsApp Business sender, and Meta's own approval of
 * message templates before anything can be sent — none of which can
 * happen inside a coding session. Writing a real integration against
 * that API here would mean guessing at credentials and endpoints this
 * project doesn't have and can't test, which is worse than not writing
 * it: broken, untestable code is worse than an honest gap.
 *
 * What's here instead is the seam a real integration drops into later:
 * the same shape sendEmail() has (recipient, content in, ok/error out),
 * gated behind WHATSAPP_ENABLED so the rest of the notification system
 * can call this unconditionally and get a clean "not available" rather
 * than needing to know WhatsApp doesn't exist yet.
 *
 * When this gets built for real: Trainee.phone already exists (M9) and
 * is exactly what a WhatsApp send needs — no schema change required to
 * start. Register the account and templates with Meta (or a BSP), get
 * WHATSAPP_ENABLED and provider credentials into env, and this file is
 * the only one that needs a real implementation — every call site
 * already goes through notifyByEmail()'s sibling function shape in
 * log.ts, unchanged.
 */
export interface SendWhatsAppInput {
  to: string; // E.164 phone number
  templateName: string;
  variables: Record<string, string>;
}

export interface SendWhatsAppResult {
  ok: boolean;
  error?: string;
}

export function whatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === "true";
}

export async function sendWhatsApp(_input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  if (!whatsAppEnabled()) {
    return { ok: false, error: "WhatsApp is not enabled — pending Meta/BSP approval, see this file's own comment." };
  }
  // Never reached today — whatsAppEnabled() can't be true without a
  // real implementation replacing this. Left as an explicit throw
  // rather than a silent no-op so a misconfigured WHATSAPP_ENABLED=true
  // fails loudly instead of pretending to send something it can't.
  throw new Error(
    "WHATSAPP_ENABLED is true but no WhatsApp provider is implemented yet — see the comment at the top of this file."
  );
}
