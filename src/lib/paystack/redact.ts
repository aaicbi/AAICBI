/**
 * M25 — audit finding, fixed here: a real Paystack webhook payload's
 * `data.authorization` object was being stored raw, indefinitely, in
 * `PaystackEvent.payload` — confirmed directly against Paystack's own
 * documented example payloads, not assumed. That object contains a
 * genuinely reusable charge token (`authorization_code` — usable to
 * charge the customer again if it ever leaked, a real financial risk,
 * not just a privacy one) and, for bank transfer payments specifically,
 * the sender's full name and bank account number.
 *
 * `PaystackEvent.payload` exists for debugging and audit only — its
 * own schema comment already says so, and its actual business logic
 * (the idempotency guarantee) only ever needs `paystackReference` and
 * `eventType`, both stored as their own real columns already, never
 * read back out of this JSON blob. Redacting the one object with
 * genuine financial/PII risk costs nothing the field's real purpose
 * depends on.
 *
 * Deliberately drops the whole `authorization` object rather than
 * picking which fields to keep — masked card details (bin/last4) are
 * lower-risk on their own, but sit in the same object as the reusable
 * token and the bank-transfer sender PII, and a field-by-field
 * allowlist here would need to stay correct across every payment
 * channel Paystack supports (card, bank transfer, USSD, mobile money)
 * to be genuinely safe; dropping the whole object doesn't have that
 * ongoing maintenance burden.
 */
export function redactPaystackPayloadForStorage(event: unknown): unknown {
  if (typeof event !== "object" || event === null) return event;
  const cloned = JSON.parse(JSON.stringify(event));
  if (typeof cloned.data === "object" && cloned.data !== null && "authorization" in cloned.data) {
    cloned.data.authorization = { redacted: true };
  }
  return cloned;
}
