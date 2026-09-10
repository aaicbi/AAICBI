/**
 * Loop broadcast messaging — the pure, DB-free half, same split
 * discipline as rateLimitCore.ts/progressCore.ts elsewhere in this
 * project: genuinely unit-testable without a live database.
 */
import type { LoopBroadcastStatus } from "@prisma/client";

/**
 * Rebuilds an `EMAIL_FROM`-shaped value ("AAICBI <noreply@aaicbi.africa>"
 * or a bare "user@example.com") with a different display name
 * substituted in front of the same address — so a Loop broadcast's
 * email can genuinely say "Loop — Systems Manager" as the sender name,
 * not just the app's own default name, while still sending from the
 * one verified address this platform is configured to send from.
 * Falls back to the input unchanged if no senderLabel is given, or if
 * the input doesn't contain a recognizable email address to rebuild
 * around.
 */
export function buildFromHeader(emailFromEnv: string, senderLabel?: string): string {
  if (!senderLabel) return emailFromEnv;
  const match = emailFromEnv.match(/<([^>]+)>/);
  const address = match ? match[1] : emailFromEnv.trim();
  if (!address.includes("@")) return emailFromEnv;
  return `${senderLabel} <${address}>`;
}

/**
 * Maps raw fan-out counts to the honest overall status for a
 * LoopBroadcast row. `actual` is how many recipients were resolved and
 * attempted at send time (see resolveRecipients) — a separate,
 * possibly different number from what the confirmation card showed the
 * admin before they clicked Send; the send route records both,
 * honestly, rather than masking any drift between them.
 */
export function describeBroadcastStatus(actual: number, failed: number): LoopBroadcastStatus {
  if (actual === 0) return "FAILED";
  if (failed === 0) return "SENT";
  return "PARTIAL";
}
