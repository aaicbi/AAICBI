/**
 * M14 audit fix, split out on purpose — same testability reasoning as
 * every other *Core.ts file in this project: log.ts imports `prisma`
 * at module scope, which eagerly instantiates a client that (in this
 * sandbox, per the README's "Note on prisma generate") isn't fully
 * usable. This one function didn't need any of that, so it doesn't
 * import it.
 *
 * The privacy policy (docs/AAICBI_LMS_Privacy_Policy.docx and
 * /privacy-policy, Section 2) states plainly that a notification
 * record doesn't include "a separate copy of the email address beyond
 * the one already recorded as account information." That claim wasn't
 * actually being enforced before this — a provider error message was
 * written to NotificationLog.error verbatim, and it's entirely
 * plausible for an email-sending API to echo the offending address
 * back in a validation error ("Invalid recipient: x@y.com"). Redacted
 * here so the policy's claim is something this code actually
 * guarantees, not just something usually true today.
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, "[redacted]");
}

/**
 * M43 — the exact same privacy claim and the exact same risk, applied
 * to the second channel this project now has: a WhatsApp/SMS provider
 * error message could just as plausibly echo back the offending phone
 * number ("Invalid recipient: +2348012345678") as an email provider
 * echoes back an address. Matches E.164 phone number shapes (an
 * optional leading +, 7-15 digits) — deliberately not narrower to one
 * country's format, since Trainee.phone isn't validated to a specific
 * country and this needs to catch a real number regardless of shape.
 *
 * A real, honest trade-off, not a precise surgical match: this could
 * over-redact something that merely looks like a phone number (a
 * reference code, an order ID) if it happens to be 7+ consecutive
 * digits. Deliberately accepted — the cost of over-redaction here is
 * some lost debug context in a log line; the cost of under-redaction
 * is real PII actually leaking, which this whole function exists to
 * prevent. Erring toward the safer side on purpose.
 */
const PHONE_PATTERN = /\+?\d{7,15}/g;

export function redactPhoneNumbers(text: string): string {
  return text.replace(PHONE_PATTERN, "[redacted]");
}
