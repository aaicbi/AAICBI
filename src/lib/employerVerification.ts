/**
 * M31 — a real, deterministic signal worth surfacing to an admin
 * reviewing an employer application: a work email at a free consumer
 * provider (gmail.com, yahoo.com, etc.) is a genuine, well-known red
 * flag for a fabricated "company" account — a real business almost
 * always registers on its own domain. This is a flag to surface, not
 * a rejection rule enforced automatically — a genuine small business
 * without its own domain yet is a real, if less common, case, and the
 * admin should see the signal and still make the actual call.
 *
 * Deliberately pure and synchronous, no network lookup, so this is
 * genuinely unit testable — the same discipline as every other real
 * decision function in this project.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "yandex.com",
  "gmx.com",
]);

export function isFreeEmailProvider(email: string): boolean {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return false;
  const domain = email.slice(atIndex + 1).toLowerCase();
  return FREE_EMAIL_DOMAINS.has(domain);
}
