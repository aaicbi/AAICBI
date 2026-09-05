/**
 * M43 — the real gate before ever attempting a WhatsApp send: a
 * trainee must have explicitly opted in AND have a verified number,
 * not just a phone number on file. Deliberately pure and synchronous
 * so this is genuinely unit testable, the same discipline as every
 * other real decision function in this project.
 */
export interface WhatsAppEligibilityInput {
  whatsappOptIn: boolean;
  whatsappVerifiedAt: Date | null;
  phone: string | null;
}

export function isEligibleForWhatsApp(trainee: WhatsAppEligibilityInput): boolean {
  return trainee.whatsappOptIn && trainee.whatsappVerifiedAt !== null && !!trainee.phone;
}
