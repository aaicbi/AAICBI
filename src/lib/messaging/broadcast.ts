/**
 * Loop broadcast messaging — the actual fan-out. Named apart from
 * "loop" deliberately: this is meant to be genuinely reusable
 * platform-level infrastructure for any future admin-composed message
 * (automated reminders, course notifications, security alerts —
 * whatever comes next), not something wired specifically to one Loop
 * command.
 *
 * Same per-recipient independence guarantee as notifyAllAdminStaff
 * (src/lib/notifications/notifyAllAdminStaff.ts) — one recipient's
 * failure never blocks another's — with one deliberate deviation from
 * that function's shape: recipients are processed in concurrency-
 * limited batches rather than a fully serial loop. A serial loop over
 * a genuinely large broadcast (each recipient doing an email HTTP call
 * plus two DB writes inside notifyByEmail) risks the route's own
 * execution time limit; sending everything at once risks overwhelming
 * Resend/Postgres connection limits. Batches of 25 are a reasonable
 * middle ground for this platform's real scale, not a tuned constant.
 */
import { notifyByEmail } from "@/lib/notifications/log";
import type { ResolvedRecipient } from "@/lib/messaging/recipients";

const BATCH_SIZE = 25;

export interface SendBroadcastInput {
  recipients: ResolvedRecipient[];
  senderLabel: string;
  subject: string;
  body: string;
  broadcastId: string;
}

export interface SendBroadcastResult {
  sentCount: number;
  failedCount: number;
}

export async function sendBroadcast(input: SendBroadcastInput): Promise<SendBroadcastResult> {
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < input.recipients.length; i += BATCH_SIZE) {
    const batch = input.recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((r) =>
        notifyByEmail({
          recipientType: r.type,
          recipientId: r.id,
          to: r.email,
          type: "LOOP_BROADCAST",
          relatedId: input.broadcastId,
          senderLabel: input.senderLabel,
          subject: input.subject,
          html: `<p>${escapeHtml(input.body).replace(/\n/g, "<br>")}</p>`,
          text: input.body,
        })
      )
    );
    for (const result of results) {
      // notifyByEmail itself never throws (it's designed to degrade
      // gracefully — see its own doc comment) and doesn't report
      // per-recipient success back to its caller, so "sent" here means
      // "the attempt didn't reject," matching the same honest,
      // best-effort accounting notifyAllAdminStaff's own callers rely
      // on. The real per-recipient delivery truth lives in
      // NotificationLog (relatedId = this broadcast's id), written by
      // notifyByEmail itself.
      if (result.status === "fulfilled") sentCount++;
      else failedCount++;
    }
  }

  return { sentCount, failedCount };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
