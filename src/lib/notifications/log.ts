/**
 * M14 — the orchestration layer every trigger site actually calls:
 * sends the email (src/lib/notifications/email.ts) and records what
 * happened (NotificationLog — see its schema comment) in one place, so
 * no call site has to remember to do both. Never throws — a failure
 * here must never break registration, password reset, module
 * unlocking, or exam submission, the flows this gets called from.
 */
import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/push/send";
import { sendEmail } from "@/lib/notifications/email";
import { redactEmails, redactPhoneNumbers } from "@/lib/notifications/redact";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { isEligibleForWhatsApp } from "@/lib/notifications/whatsappEligibility";

export type NotificationType =
  | "WELCOME"
  | "PASSWORD_RESET_STAFF"
  | "PASSWORD_RESET_TRAINEE"
  | "MODULE_UNLOCKED"
  | "ASSESSMENT_RESULT"
  | "CERTIFICATE_ISSUED"
  | "EARLY_WARNING_STAFF"
  | "EARLY_WARNING_TRAINEE"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_ENDING"
  | "SUBSCRIPTION_ENDED"
  | "PAYMENT_OTP"
  | "MATERIAL_UPDATED"
  | "QA_REPLY"
  | "INTRODUCTION_REQUEST"
  | "EMPLOYER_APPROVED"
  | "EMPLOYER_REJECTED"
  | "JOB_POSTING_APPROVED"
  | "JOB_POSTING_REJECTED"
  | "INTRODUCTION_RESPONSE"
  | "NEW_EMPLOYER_PENDING"
  | "NEW_JOB_POSTING_PENDING"
  | "STAFF_ACCOUNT_CREATED"
  | "LIKELY_DUPLICATE_PAYMENT"
  | "ACCESS_EXPIRING_REMINDER"
  // RECURRING_SUBSCRIPTION counterpart to ACCESS_EXPIRING_REMINDER
  // above — see subscriptionRenewingReminderEmail's own comment for why
  // this is a distinct, informational-toned notice rather than a reuse
  // of that one.
  | "SUBSCRIPTION_RENEWING_REMINDER"
  | "PAYMENT_RECEIPT"
  // Loop broadcast messaging — a message a Super Admin directed Loop
  // to send, delivered through this exact same pipeline. Never
  // excluded from the in-app feed (see IN_APP_EXCLUDED_TYPES below) —
  // a broadcast always produces a real, visible UserNotification.
  | "LOOP_BROADCAST"
  // The reverse direction — a plain "you have a new message" ping sent
  // to every Super Admin when someone messages them through the direct
  // inbox (see SuperAdminMessage's own schema comment). This is only
  // the notification; the actual message content lives in
  // SuperAdminMessage, read via GET /api/admin/inbox.
  | "MESSAGE_TO_ADMIN"
  // A staff member granted a trainee ADMIN_GRANTED access to a course
  // (POST /api/courses/[id]/enrollments) — the trainee's only real
  // discovery path for an UNLISTED course, which has no catalog listing
  // to stumble onto.
  | "COURSE_ACCESS_GRANTED"
  // Pitch & Post, Phase 1.
  | "INVESTOR_ACCOUNT_CREATED"
  | "PITCH_SUBMITTED"
  | "PITCH_NEEDS_REVISION"
  | "PITCH_APPROVED"
  | "PITCH_REJECTED"
  | "PITCH_PUBLISHED"
  | "PITCH_DISCLOSURE_REQUESTED"
  | "PITCH_DISCLOSURE_RESPONSE"
  | "PITCH_INTEREST_RECEIVED"
  // Pitch & Post, Phase 2 — investor self-registration.
  | "NEW_INVESTOR_PENDING"
  | "INVESTOR_APPROVED"
  | "INVESTOR_REJECTED"
  // Instructor Portal, Phase 1.
  | "INSTRUCTOR_AGREEMENT_SENT"
  | "INSTRUCTOR_AGREEMENT_ACCEPTED"
  // Standalone-exam access control — a Super Admin has granted a
  // trainee access to an exam that isn't part of any course.
  | "EXAM_ACCESS_GRANTED"
  // Instructor Portal, Phase 1 follow-up — an instructor has been
  // assigned as the instructor of record for a course (Course.createdById).
  | "COURSE_INSTRUCTOR_ASSIGNED"
  // Standalone-exam certificates — see ExamCertificate's own schema
  // comment.
  | "EXAM_CERTIFICATE_ISSUED"
  // Analytics System Phase 4 — one shared type for all four alert
  // rules in src/lib/analytics/alerts.ts; the subject/body text (not
  // the type) is what actually distinguishes a registration-drop alert
  // from a conversion-rate alert, same as several other notification
  // types in this list already carry varied content under one type.
  | "ANALYTICS_ALERT"
  // Analytics System Phase 5 — the weekly scheduled report (a PDF
  // attachment, src/app/api/cron/analytics-report/route.ts). A
  // genuinely different kind of notification from ANALYTICS_ALERT
  // above — scheduled and informational, never threshold-triggered —
  // so it gets its own type rather than being folded into that one.
  | "ANALYTICS_REPORT"
  // Community Showcase moderation — a trainee's showcase post has been
  // decided. Same pair shape as JOB_POSTING_APPROVED/REJECTED above.
  | "PROJECT_APPROVED"
  | "PROJECT_REJECTED"
  // Training Organizations, Phase 1 — same pair-plus-pending shape as
  // NEW_EMPLOYER_PENDING/EMPLOYER_APPROVED/EMPLOYER_REJECTED.
  | "NEW_TRAINING_ORG_PENDING"
  | "TRAINING_ORG_APPROVED"
  | "TRAINING_ORG_REJECTED"
  // A SUPER_ADMIN finished designing a certificate template and sent it
  // to the organization for review via the share link.
  | "CERTIFICATE_TEMPLATE_READY"
  // Direct platform-fee billing — a training organization's own
  // platform-fee payment succeeded, or their access was paused after a
  // failed/cancelled renewal. Addressed to the organization (recipientType
  // "TRAINING_ORG", same as the approval pair above), not a trainee.
  | "PLATFORM_FEE_PAID"
  | "PLATFORM_FEE_ACCESS_REVOKED"
  // Certificate watermark removal — a second, independent subscription
  // product (see TrainingOrganization's own certWatermark* schema
  // comment), same pair shape as PLATFORM_FEE_PAID/
  // PLATFORM_FEE_ACCESS_REVOKED above but for this separate product.
  | "CERT_WATERMARK_FEE_PAID"
  | "CERT_WATERMARK_ACCESS_REVOKED"
  // AI Assignment Engine — to the trainee: an assignment they can take
  // has been published, their submission has been AI-assessed (or sent
  // to their instructor for manual grading), or their instructor has
  // requested a resubmission. To the instructor: a submission has come
  // in for manual grading (aiAssessmentEnabled: false).
  | "ASSIGNMENT_PUBLISHED"
  | "ASSIGNMENT_SUBMITTED"
  | "ASSIGNMENT_ASSESSED"
  | "ASSIGNMENT_RESUBMISSION_REQUESTED"
  // AI Assignment Engine, Phase 2 — the due-date reminder pair, sent
  // only to a trainee who hasn't submitted yet (see
  // assignmentReminders.ts's own comment).
  | "ASSIGNMENT_DUE_SOON"
  | "ASSIGNMENT_OVERDUE";

export interface NotifyByEmailInput {
  recipientType: "TRAINEE" | "STAFF" | "EMPLOYER" | "INVESTOR" | "TRAINING_ORG";
  recipientId: string;
  to: string;
  type: NotificationType;
  relatedId?: string;
  subject: string;
  html: string;
  text: string;
  // A real, persistent in-app notification (see UserNotification's own
  // schema comment) is created automatically for almost every call to
  // this function — see IN_APP_EXCLUDED_TYPES below for the deliberate
  // exceptions — so most call sites never need to think about this at
  // all. `url` is the one thing worth passing explicitly when a caller
  // has one: the destination a click on the in-app notification should
  // go to, typically the same link already embedded in the email's own
  // button. Optional — a notification with no url is still real and
  // visible, just not click-through.
  url?: string;
  // M43 — optional, only for the specific events the roadmap names as
  // also reaching WhatsApp: verification, password reset, module
  // unlock, certificates, and the M28 paid-enrollment OTP. When
  // present AND the recipient trainee has opted in with a verified
  // number, this is attempted as a genuine SECOND channel alongside
  // email, not instead of it — email always sends regardless of this
  // field. WhatsApp Business requires Meta-approved message templates,
  // not free-form text the way email allows, which is why this is a
  // template name plus variables, not html/text reused from the email
  // content above.
  whatsapp?: { templateName: string; variables: Record<string, string> };
  // Loop broadcast messaging — who the RECIPIENT should believe this
  // came from, e.g. "Loop — Systems Manager." Threaded to both the
  // email's own display name (see sendEmail's fromName) and the
  // UserNotification row's senderLabel column (see that model's own
  // schema comment for the full reasoning). Undefined for every
  // existing call site — every other notification type stays exactly
  // "from the system," unchanged.
  senderLabel?: string;
  // Instructor Portal — passed straight through to sendEmail. See that
  // function's own comment; undefined for every other call site.
  attachments?: { filename: string; content: Buffer }[];
}

// The deliberate exclusions from the in-app feed — everything else
// gets one automatically. Each of these is either genuinely ephemeral
// (a time-limited code or link nobody would want to scroll back to
// later) or fires before the recipient could possibly be logged in to
// see a notification bell at all (WELCOME fires at registration,
// PASSWORD_RESET fires for someone who by definition can't sign in
// right now). A real, explicit list rather than an implicit "only
// some types opt in" — so extending this function to a brand new
// event type in the future means an in-app notification by default,
// not something easy to forget to wire up.
const IN_APP_EXCLUDED_TYPES = new Set<NotificationType>([
  "WELCOME",
  "PASSWORD_RESET_STAFF",
  "PASSWORD_RESET_TRAINEE",
  "PAYMENT_OTP",
]);

// M14 audit finding: the privacy policy (docs/AAICBI_LMS_Privacy_Policy.docx
// and /privacy-policy, Section 2) now states plainly that a notification
// record doesn't include "a separate copy of the email address beyond
// the one already recorded as account information." That claim wasn't
// actually being enforced — a provider error message is written to
// NotificationLog.error verbatim, and it's entirely plausible for an
// email-sending API to echo the offending address back in a validation
// error ("Invalid recipient: x@y.com"). Redacted (see redact.ts) before
// storage so the policy's claim is something this code actually
// guarantees, not just something usually true today.

export async function notifyByEmail(input: NotifyByEmailInput): Promise<void> {
  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    fromName: input.senderLabel,
    attachments: input.attachments,
  });

  try {
    await prisma.notificationLog.create({
      data: {
        recipientType: input.recipientType,
        recipientId: input.recipientId,
        type: input.type,
        channel: "EMAIL",
        relatedId: input.relatedId,
        status: result.ok ? "SENT" : "FAILED",
        error: result.ok || !result.error ? null : redactEmails(result.error),
      },
    });
  } catch (e) {
    // Logging the attempt failed too (a DB blip, say) — this must
    // still never propagate. Worst case: a real send happened without
    // a log row for it, which is a worse-but-survivable gap in
    // observability, not a broken user-facing flow.
    console.error("Failed to write NotificationLog:", e);
  }

  // M43 — the actual dual-channel dispatch. Deliberately a SEPARATE
  // NotificationLog row per channel (matching what channel's own
  // schema comment already says — "EMAIL" today, "WHATSAPP" a real
  // value once live), not one combined row — each channel's send
  // succeeds or fails independently and deserves its own record.
  // Never allowed to affect the email result above in either
  // direction: this runs after email's own log write, and any
  // failure here is caught and logged, never propagated.
  if (input.whatsapp && input.recipientType === "TRAINEE") {
    try {
      const trainee = await prisma.trainee.findUnique({
        where: { id: input.recipientId },
        select: { whatsappOptIn: true, whatsappVerifiedAt: true, phone: true },
      });
      if (trainee && isEligibleForWhatsApp(trainee)) {
        const waResult = await sendWhatsApp({
          to: trainee.phone!,
          templateName: input.whatsapp.templateName,
          variables: input.whatsapp.variables,
        });
        await prisma.notificationLog.create({
          data: {
            recipientType: "TRAINEE",
            recipientId: input.recipientId,
            type: input.type,
            channel: "WHATSAPP",
            relatedId: input.relatedId,
            status: waResult.ok ? "SENT" : "FAILED",
            error: waResult.ok || !waResult.error ? null : redactPhoneNumbers(waResult.error),
          },
        });
      }
    } catch (e) {
      console.error("WhatsApp dispatch failed:", e);
    }
  }

  // The in-app notification — a real, persistent entry in the feed a
  // trainee/staff/employer actually sees when they open the bell, not
  // just an email that could go unread or land in spam. Deliberately
  // created regardless of whether the email itself succeeded — the
  // event happened either way, and an in-app notification doesn't
  // depend on a third-party email provider being reachable the way
  // email delivery does. Wrapped the same way every other side effect
  // in this function is: a failure here must never propagate and
  // break the actual flow this was called from.
  if (!IN_APP_EXCLUDED_TYPES.has(input.type)) {
    try {
      await prisma.userNotification.create({
        data: {
          recipientType: input.recipientType,
          recipientId: input.recipientId,
          type: input.type,
          title: input.subject,
          body: input.text,
          url: input.url,
          senderLabel: input.senderLabel ?? null,
        },
      });
      // Also a web push, for people who turned notifications on for a device.
      await sendPushForNotification(input.recipientType, input.recipientId, { type: input.type, title: input.subject, body: input.text, url: input.url });
    } catch (e) {
      console.error("Failed to write UserNotification:", e);
    }
  }

  await maybePruneOldLogs();
}

// Retention gap flagged across the M14/M15 audits, finally closed:
// NotificationLog had no pruning at all and would grow forever. This
// project has no background job infrastructure (no cron, no worker —
// see examEngine.ts's expireStaleAttemptsForTrainee for the same
// constraint solved a different way), so a real scheduled job isn't an
// option without adding one.
//
// Chose prune-on-write instead, at low probability, rather than a
// staff-triggered "clean up now" button: a manual button is real, but
// it's also the kind of thing that quietly never gets clicked once the
// person who built it stops thinking about it. Firing on roughly 1 in
// 200 notification sends means the table stays bounded automatically,
// with no one having to remember it exists — the extra DELETE query is
// cheap, and running it on 0.5% of an already-happening write (never
// on the hot path of a read) keeps the added cost negligible.
const RETENTION_DAYS = 180;
const PRUNE_PROBABILITY = 0.005;

async function maybePruneOldLogs(): Promise<void> {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.notificationLog.deleteMany({ where: { sentAt: { lt: cutoff } } });
  } catch (e) {
    console.error("NotificationLog pruning failed (non-fatal, will retry on a later send):", e);
  }
}

/**
 * Whether a TRAINEE should receive an OPTIONAL notification (module
 * unlocked, assessment result) — never called for the essential ones
 * (welcome, password reset), which always send. See the schema
 * comment on Trainee.notificationsEnabled for why there's no UI to
 * actually change this yet.
 */
export function shouldNotifyTrainee(trainee: { notificationsEnabled: boolean }): boolean {
  return trainee.notificationsEnabled;
}
