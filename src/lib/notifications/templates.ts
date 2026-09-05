/**
 * M14 — the actual content of every email this project sends. Kept
 * pure (data in, {subject, html, text} out, no Prisma/network) on
 * purpose — same testability reasoning as every other *Core.ts file in
 * this project, just organized by folder here instead. src/lib/
 * notifications/log.ts is what actually calls sendEmail() with what
 * these functions build.
 *
 * Every template ships both html and text — a plain-text fallback
 * isn't optional politeness, some real mail clients and screen readers
 * still prefer or require it, and it costs nothing to write both
 * together while the content is already in front of you.
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND_TEAL = "#016B61";

function wrapHtml(bodyHtml: string): string {
  // Minimal, table-free HTML that renders reasonably in every major
  // mail client without needing a dedicated email-HTML build step —
  // deliberately not the full AAICBI brand system (Poppins, the full
  // Dawn Sage Lively palette) used elsewhere in this project, since
  // email clients strip custom fonts and many CSS features anyway;
  // this matches what actually survives the trip, not what looks best
  // in a browser preview.
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#F7F4EE;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <p style="margin:0 0 24px;font-size:13px;font-weight:bold;letter-spacing:0.05em;color:${BRAND_TEAL};text-transform:uppercase;">AAICBI</p>
      ${bodyHtml}
      <p style="margin:32px 0 0;font-size:12px;color:#888;">Africa's AI Capacity Building Initiative · Futybills Tech Community · Uyo, Akwa Ibom State, Nigeria</p>
    </div>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:${BRAND_TEAL};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">${label}</a></p>
<p style="margin:0 0 24px;font-size:12px;color:#888;word-break:break-all;">If the button doesn't work, copy this link: ${url}</p>`;
}

export function welcomeEmail(name: string, verifyUrl: string): EmailContent {
  return {
    subject: "Verify your AAICBI account",
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">Welcome to the AAICBI Learning Management System. Verify your email address to activate your account and start your courses.</p>
      ${button(verifyUrl, "Verify Email Address")}
      <p style="margin:0;font-size:13px;color:#666;">This link expires in 48 hours. If you didn't create this account, you can ignore this email.</p>
    `),
    text: `Hi ${name},

Welcome to the AAICBI Learning Management System. Verify your email address to activate your account and start your courses.

${verifyUrl}

This link expires in 48 hours. If you didn't create this account, you can ignore this email.`,
  };
}

export function passwordResetEmail(recipientLabel: "staff" | "trainee", resetUrl: string): EmailContent {
  const audience = recipientLabel === "staff" ? "staff" : "AAICBI";
  return {
    subject: `Reset your ${audience} account password`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">A password reset was requested for your ${audience} account.</p>
      ${button(resetUrl, "Reset Password")}
      <p style="margin:0;font-size:13px;color:#666;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change unless you click the link above.</p>
    `),
    text: `A password reset was requested for your ${audience} account.

${resetUrl}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change unless you click the link above.`,
  };
}

export function moduleUnlockedEmail(
  traineeName: string,
  courseTitle: string,
  nextModuleTitle: string,
  courseUrl: string
): EmailContent {
  return {
    subject: `You've unlocked the next module in ${courseTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Nice work, ${escapeHtml(traineeName)}!</p>
      <p style="margin:0 0 16px;">You've completed the previous module in <strong>${escapeHtml(courseTitle)}</strong> — the next module, <strong>${escapeHtml(nextModuleTitle)}</strong>, is now unlocked.</p>
      ${button(courseUrl, "Continue the Course")}
    `),
    text: `Nice work, ${traineeName}!

You've completed the previous module in ${courseTitle} — the next module, ${nextModuleTitle}, is now unlocked.

${courseUrl}`,
  };
}

export interface AssessmentResultEmailInput {
  traineeName: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  passMarkPercent: number;
  courseUrl: string;
  /** Optional — only present when M13's AI analysis produced one for
   * this attempt. Never required; the email is complete without it. */
  performanceSummary?: { strengths: string[]; weaknesses: string[]; narrative: string } | null;
}

export function assessmentResultEmail(input: AssessmentResultEmailInput): EmailContent {
  const statusLine = input.passed ? "You passed!" : "Not quite this time — you can try again.";
  const summaryHtml = input.performanceSummary
    ? `<div style="margin:16px 0;padding:16px;background:#E4EEE7;border-radius:6px;">
         <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:${BRAND_TEAL};">HOW YOU DID BY TOPIC</p>
         <p style="margin:0;font-size:14px;">${escapeHtml(input.performanceSummary.narrative)}</p>
       </div>`
    : "";
  const summaryText = input.performanceSummary ? `\n\nHow you did by topic: ${input.performanceSummary.narrative}` : "";

  return {
    subject: `Your result for ${input.examTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 8px;font-weight:bold;color:${input.passed ? BRAND_TEAL : "#b91c1c"};">${statusLine}</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:bold;">${input.score}<span style="font-size:16px;color:#888;">/${input.totalQuestions}</span> — ${Math.round(input.percentage)}%</p>
      <p style="margin:0 0 16px;font-size:13px;color:#666;">Pass mark for ${escapeHtml(input.examTitle)}: ${input.passMarkPercent}%</p>
      ${summaryHtml}
      ${button(input.courseUrl, "Back to Course")}
    `),
    text: `Hi ${input.traineeName},

${statusLine}

${input.score}/${input.totalQuestions} — ${Math.round(input.percentage)}%
Pass mark for ${input.examTitle}: ${input.passMarkPercent}%${summaryText}

${input.courseUrl}`,
  };
}

export interface CertificateIssuedEmailInput {
  traineeName: string;
  courseTitle: string;
  certificateCode: string;
  verificationUrl: string;
}

export function certificateIssuedEmail(input: CertificateIssuedEmailInput): EmailContent {
  return {
    subject: `Your certificate for ${input.courseTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Congratulations, ${escapeHtml(input.traineeName)}!</p>
      <p style="margin:0 0 16px;">You&apos;ve completed every module in <strong>${escapeHtml(input.courseTitle)}</strong> — your certificate is ready.</p>
      <p style="margin:0 0 16px;font-size:13px;color:#666;">Certificate code: <strong style="color:#1a1a1a;">${escapeHtml(input.certificateCode)}</strong></p>
      ${button(input.verificationUrl, "View & Share Your Certificate")}
      <p style="margin:0;font-size:13px;color:#666;">Anyone can verify this certificate at the link above — no login required.</p>
    `),
    text: `Congratulations, ${input.traineeName}!

You've completed every module in ${input.courseTitle} — your certificate is ready.

Certificate code: ${input.certificateCode}

${input.verificationUrl}

Anyone can verify this certificate at that link — no login required.`,
  };
}

// M14 audit finding: this was missing single-quote escaping. Rechecked
// every call site in this file at the time — every user-controlled
// string (trainee name, course/exam/module titles, the AI narrative)
// was already routed through this function, and none of today's
// templates interpolate a value inside a single-quoted HTML attribute,
// so this was never actually exploitable — but it was a landmine for
// whichever template gets added next and does. Fixed properly rather
// than left as a "works today" gap.
// M38 — Staff Early-Warning Dashboard. Two templates, matching the
// existing STAFF/TRAINEE split pattern used everywhere else in this
// file (see PASSWORD_RESET_STAFF/PASSWORD_RESET_TRAINEE) — genuinely
// different audiences, different tone, different content, not one
// template reused twice.

export interface EarlyWarningStaffEmailInput {
  traineeName: string;
  courseTitle: string;
  reason: "inactivity" | "failed-attempts";
  detail: string; // e.g. "hasn't logged in for 9 days" or "has failed 3 attempts"
  dashboardUrl: string;
}

export function earlyWarningStaffEmail(input: EarlyWarningStaffEmailInput): EmailContent {
  return {
    subject: `${input.traineeName} may need a check-in — ${input.courseTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">A trainee in <strong>${escapeHtml(input.courseTitle)}</strong> just crossed a threshold you set.</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.traineeName)}</strong> ${escapeHtml(input.detail)}.</p>
      ${button(input.dashboardUrl, "Open the Dashboard")}
    `),
    text: `A trainee in ${input.courseTitle} just crossed a threshold you set.\n\n${input.traineeName} ${input.detail}.\n\n${input.dashboardUrl}`,
  };
}

export interface EarlyWarningTraineeEmailInput {
  traineeName: string;
  courseTitle: string;
  courseUrl: string;
  reason: "inactivity" | "failed-attempts";
}

// Deliberately warm, never clinical — this is a genuine check-in, not
// a system notice that a threshold was crossed. The trainee should
// never see the word "threshold," "alert," or anything that reads
// like they've been flagged by an algorithm. Reason-aware: a trainee
// who's been actively attempting and failing shouldn't get "we noticed
// you've been away" — that's the wrong message for someone who's very
// much still showing up, just struggling.
export function earlyWarningTraineeEmail(input: EarlyWarningTraineeEmailInput): EmailContent {
  const body =
    input.reason === "inactivity"
      ? `We noticed it's been a little while since you were last in <strong>${escapeHtml(input.courseTitle)}</strong> — just checking in. Everything okay? Pick up right where you left off whenever you're ready.`
      : `We noticed you've had a tough time with a few attempts in <strong>${escapeHtml(input.courseTitle)}</strong> — that happens, and it's completely okay. If anything's unclear, this is a great moment to revisit the lesson material before your next try.`;
  const bodyText =
    input.reason === "inactivity"
      ? `We noticed it's been a little while since you were last in ${input.courseTitle} — just checking in. Everything okay? Pick up right where you left off whenever you're ready.`
      : `We noticed you've had a tough time with a few attempts in ${input.courseTitle} — that happens, and it's completely okay. If anything's unclear, this is a great moment to revisit the lesson material before your next try.`;
  const subject =
    input.reason === "inactivity"
      ? `We noticed you've been away from ${input.courseTitle}`
      : `A quick note about ${input.courseTitle}`;
  return {
    subject,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;">${body}</p>
      ${button(input.courseUrl, "Return to the Course")}
    `),
    text: `Hi ${input.traineeName},\n\n${bodyText}\n\n${input.courseUrl}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * M27 — the three trainee-facing notifications a subscription's real
 * lifecycle needs, matching the exact distinction Paystack's own event
 * model makes and this milestone's webhook handling relies on:
 * a failed charge Paystack is still retrying is NOT the same thing as
 * access actually ending, and a cancellation notice is NOT the same
 * moment as access actually ending either — see the webhook route's
 * own comments on `subscription.not_renew` vs `subscription.disable`
 * for the full reasoning. Each template's wording deliberately
 * reflects that distinction rather than blurring it into one generic
 * "something happened with your payment" message.
 */
export interface PaymentFailedEmailInput {
  traineeName: string;
  courseTitle: string;
  courseUrl: string;
}
export function paymentFailedEmail(input: PaymentFailedEmailInput): EmailContent {
  return {
    subject: `We couldn't process your payment for ${input.courseTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;">Your latest payment for <strong>${escapeHtml(input.courseTitle)}</strong> didn't go through. We'll automatically try again over the next few days — your access hasn't been affected yet.</p>
      <p style="margin:0 0 16px;">If your card has expired or changed, updating your payment details will help the next attempt succeed.</p>
      ${button(input.courseUrl, "Go to the Course")}
    `),
    text: `Hi ${input.traineeName},\n\nYour latest payment for ${input.courseTitle} didn't go through. We'll automatically try again over the next few days — your access hasn't been affected yet.\n\nIf your card has expired or changed, updating your payment details will help the next attempt succeed.\n\n${input.courseUrl}`,
  };
}

export interface SubscriptionEndingEmailInput {
  traineeName: string;
  courseTitle: string;
  accessUntil: string;
  courseUrl: string;
}
export function subscriptionEndingEmail(input: SubscriptionEndingEmailInput): EmailContent {
  return {
    subject: `Your subscription to ${input.courseTitle} won't renew`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;">Your subscription to <strong>${escapeHtml(input.courseTitle)}</strong> has been set to not renew. You'll keep full access until <strong>${escapeHtml(input.accessUntil)}</strong> — the time you've already paid for is still yours.</p>
      ${button(input.courseUrl, "Go to the Course")}
    `),
    text: `Hi ${input.traineeName},\n\nYour subscription to ${input.courseTitle} has been set to not renew. You'll keep full access until ${input.accessUntil} — the time you've already paid for is still yours.\n\n${input.courseUrl}`,
  };
}

export interface SubscriptionEndedEmailInput {
  traineeName: string;
  courseTitle: string;
  courseUrl: string;
}
export function subscriptionEndedEmail(input: SubscriptionEndedEmailInput): EmailContent {
  return {
    subject: `Your access to ${input.courseTitle} has ended`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;">Your subscription to <strong>${escapeHtml(input.courseTitle)}</strong> has ended, and access to the course content has been paused. You're welcome to subscribe again any time to pick up where you left off.</p>
      ${button(input.courseUrl, "View the Course")}
    `),
    text: `Hi ${input.traineeName},\n\nYour subscription to ${input.courseTitle} has ended, and access to the course content has been paused. You're welcome to subscribe again any time to pick up where you left off.\n\n${input.courseUrl}`,
  };
}

/**
 * M28 — the OTP unlock email. One secret, two ways to use it,
 * confirmed against the schema comment on CourseEnrollment.otpCode:
 * the code itself in plain text for a trainee who wants to type it in
 * by hand, and a link that embeds it for one-click verification —
 * genuinely the same code either way, not two different mechanisms.
 */
export interface PaymentOtpEmailInput {
  traineeName: string;
  courseTitle: string;
  otpCode: string;
  verifyUrl: string;
  expiryMinutes: number;
}
export function paymentOtpEmail(input: PaymentOtpEmailInput): EmailContent {
  return {
    subject: `Your unlock code for ${input.courseTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;">Your payment for <strong>${escapeHtml(input.courseTitle)}</strong> went through — one more step to unlock it. Enter this code, or use the button below:</p>
      <p style="margin:0 0 16px;text-align:center;font-size:32px;font-weight:700;letter-spacing:6px;color:#1a1a1a;">${escapeHtml(input.otpCode)}</p>
      ${button(input.verifyUrl, "Unlock the Course")}
      <p style="margin:16px 0 0;font-size:13px;color:#666;">This code expires in ${input.expiryMinutes} minutes.</p>
    `),
    text: `Hi ${input.traineeName},\n\nYour payment for ${input.courseTitle} went through — one more step to unlock it.\n\nYour code: ${input.otpCode}\n\n${input.verifyUrl}\n\nThis code expires in ${input.expiryMinutes} minutes.`,
  };
}

/**
 * M40 — a downloaded material's content changed. Requires tracking
 * who downloaded what (MaterialDownload), not just firing an email —
 * this is the trainee-facing half of that tracking, per the roadmap's
 * own scope: offline reading has no way to reach into a trainee's own
 * device and update or revoke a file already saved there, so the
 * honest, achievable thing is telling them plainly that their copy is
 * now out of date, not pretending the app can fix it for them.
 */
export interface MaterialUpdatedEmailInput {
  traineeName: string;
  materialTitle: string;
  courseTitle: string;
  courseUrl: string;
}
export function materialUpdatedEmail(input: MaterialUpdatedEmailInput): EmailContent {
  return {
    subject: `Updated: ${input.materialTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.materialTitle)}</strong> in <strong>${escapeHtml(input.courseTitle)}</strong> has been updated since you downloaded it for offline use. The copy saved on your device is now out of date — download it again to get the latest version.</p>
      ${button(input.courseUrl, "Go to the Course")}
    `),
    text: `Hi ${input.traineeName},\n\n${input.materialTitle} in ${input.courseTitle} has been updated since you downloaded it for offline use. The copy saved on your device is now out of date — download it again to get the latest version.\n\n${input.courseUrl}`,
  };
}

/**
 * M41 — audit finding, closed here: a Q&A feature with no way for the
 * person who asked a question to know it's been answered doesn't
 * fulfill its own basic purpose. Deliberately scoped to notifying the
 * thread's original creator when someone else replies, not every
 * participant on every reply — the simplest, most clearly-in-scope fix
 * for the actual gap ("did my question get answered"), not a full
 * discussion-forum notification system.
 */
export interface QaReplyEmailInput {
  traineeName: string;
  replierName: string;
  threadTitle: string;
  threadUrl: string;
}
export function qaReplyEmail(input: QaReplyEmailInput): EmailContent {
  return {
    subject: `New reply: ${input.threadTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.replierName)}</strong> replied to your question, <strong>${escapeHtml(input.threadTitle)}</strong>.</p>
      ${button(input.threadUrl, "View the Reply")}
    `),
    text: `Hi ${input.traineeName},\n\n${input.replierName} replied to your question, ${input.threadTitle}.\n\n${input.threadUrl}`,
  };
}

/**
 * M33 — a trainee being notified a real employer has expressed
 * interest. Deliberately never includes the employer's own contact
 * details here — this is the notice that a request exists, not a
 * disclosure of anything; the trainee still has to actively accept
 * before any information changes hands in either direction.
 */
export interface IntroductionRequestEmailInput {
  traineeName: string;
  companyName: string;
  introductionsUrl: string;
}
export function introductionRequestEmail(input: IntroductionRequestEmailInput): EmailContent {
  return {
    subject: `${input.companyName} is interested in connecting`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.traineeName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.companyName)}</strong> found your profile on AAICBI and would like to connect. Nothing is shared with them until you decide — review the request and choose what to share, if anything.</p>
      ${button(input.introductionsUrl, "Review the Request")}
    `),
    text: `Hi ${input.traineeName},\n\n${input.companyName} found your profile on AAICBI and would like to connect. Nothing is shared with them until you decide.\n\n${input.introductionsUrl}`,
  };
}

/**
 * M31 — audit finding, closed here: an employer registers and has no
 * way to know their account was decided on except manually logging
 * back in and checking. Treated as essential, not optional, the same
 * way password reset and verification emails already work for
 * trainees — an employer has no notification-preference toggle to
 * gate this behind in the first place, and an account-status
 * decision is exactly the kind of thing that shouldn't be silently
 * missable.
 */
export interface EmployerDecisionEmailInput {
  contactName: string;
  loginUrl: string;
}
export function employerApprovedEmail(input: EmployerDecisionEmailInput): EmailContent {
  return {
    subject: "Your AAICBI employer account is approved",
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.contactName)},</p>
      <p style="margin:0 0 16px;">Your employer account has been approved. You can now browse discoverable trainees and post job vacancies.</p>
      ${button(input.loginUrl, "Sign In")}
    `),
    text: `Hi ${input.contactName},\n\nYour employer account has been approved. You can now browse discoverable trainees and post job vacancies.\n\n${input.loginUrl}`,
  };
}
export function employerRejectedEmail(input: EmployerDecisionEmailInput): EmailContent {
  return {
    subject: "Update on your AAICBI employer account",
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.contactName)},</p>
      <p style="margin:0 0 16px;">Your employer account application wasn't approved at this time. If you believe this is a mistake, please contact support.</p>
    `),
    text: `Hi ${input.contactName},\n\nYour employer account application wasn't approved at this time. If you believe this is a mistake, please contact support.`,
  };
}

/**
 * M34 — the same real gap, closed the same way: an employer posts a
 * vacancy and has no way to know it went live (or didn't) except
 * checking back manually. Same "essential, not optional" treatment.
 */
export interface JobPostingDecisionEmailInput {
  contactName: string;
  postingTitle: string;
  postingsUrl: string;
}
export function jobPostingApprovedEmail(input: JobPostingDecisionEmailInput): EmailContent {
  return {
    subject: `Your posting "${input.postingTitle}" is now live`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.contactName)},</p>
      <p style="margin:0 0 16px;">Your posting, <strong>${escapeHtml(input.postingTitle)}</strong>, has been approved and is now visible to discoverable trainees.</p>
      ${button(input.postingsUrl, "View Your Postings")}
    `),
    text: `Hi ${input.contactName},\n\nYour posting, ${input.postingTitle}, has been approved and is now visible to discoverable trainees.\n\n${input.postingsUrl}`,
  };
}
export function jobPostingRejectedEmail(input: JobPostingDecisionEmailInput): EmailContent {
  return {
    subject: `Your posting "${input.postingTitle}" wasn't approved`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.contactName)},</p>
      <p style="margin:0 0 16px;">Your posting, <strong>${escapeHtml(input.postingTitle)}</strong>, wasn't approved. You're welcome to submit a revised posting.</p>
      ${button(input.postingsUrl, "View Your Postings")}
    `),
    text: `Hi ${input.contactName},\n\nYour posting, ${input.postingTitle}, wasn't approved. You're welcome to submit a revised posting.\n\n${input.postingsUrl}`,
  };
}

/**
 * M33 — audit finding, closed here: an employer sends an introduction
 * request and has no way to know whether the trainee accepted or
 * declined except manually checking back. Deliberately never includes
 * the trainee's own disclosed contact information directly in this
 * email, even when it was disclosed — that's available through the
 * employer's own gated view (`/employer/introductions`, which already
 * enforces exactly what was disclosed), not repeated into an email
 * body that's easier to forward or leak than a login-gated page.
 */
export interface IntroductionResponseEmailInput {
  contactName: string;
  traineeName: string;
  accepted: boolean;
  introductionsUrl: string;
}
export function introductionResponseEmail(input: IntroductionResponseEmailInput): EmailContent {
  const verb = input.accepted ? "accepted" : "declined";
  return {
    subject: `${input.traineeName} ${verb} your introduction request`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(input.contactName)},</p>
      <p style="margin:0 0 16px;"><strong>${escapeHtml(input.traineeName)}</strong> has ${verb} your introduction request.</p>
      ${button(input.introductionsUrl, "View Your Introductions")}
    `),
    text: `Hi ${input.contactName},\n\n${input.traineeName} has ${verb} your introduction request.\n\n${input.introductionsUrl}`,
  };
}

/**
 * Stage 6 audit — staff had zero proactive notification when
 * something new needed their review; the only way to know was
 * checking the review queue manually. These two fire to every
 * SUPER_ADMIN/ADMIN, not a single recipient — the actual notifyByEmail
 * call for each is made by the caller (see registration and job
 * posting creation routes), this is just the shared template.
 */
export interface NewEmployerPendingEmailInput {
  companyName: string;
  reviewUrl: string;
}
export function newEmployerPendingEmail(input: NewEmployerPendingEmailInput): EmailContent {
  return {
    subject: `New employer awaiting review: ${input.companyName}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${escapeHtml(input.companyName)}</strong> has registered as an employer and is awaiting review.</p>
      ${button(input.reviewUrl, "Review Employers")}
    `),
    text: `${input.companyName} has registered as an employer and is awaiting review.\n\n${input.reviewUrl}`,
  };
}

export interface NewJobPostingPendingEmailInput {
  companyName: string;
  postingTitle: string;
  aiFlagged: boolean;
  reviewUrl: string;
}
export function newJobPostingPendingEmail(input: NewJobPostingPendingEmailInput): EmailContent {
  return {
    subject: `New job posting awaiting review: ${input.postingTitle}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${escapeHtml(input.companyName)}</strong> submitted a new posting, <strong>${escapeHtml(input.postingTitle)}</strong>, awaiting review.${input.aiFlagged ? " AI screening flagged this one for attention." : ""}</p>
      ${button(input.reviewUrl, "Review Job Postings")}
    `),
    text: `${input.companyName} submitted a new posting, ${input.postingTitle}, awaiting review.${input.aiFlagged ? " AI screening flagged this one for attention." : ""}\n\n${input.reviewUrl}`,
  };
}

/**
 * Staff account creation — a real, dedicated template rather than
 * reusing passwordResetEmail's copy, which is genuinely wrong here:
 * "if you didn't request this, ignore it" doesn't make sense for an
 * account someone else just created for you. Reuses the exact same
 * underlying mechanism as password reset (a real token, the same
 * /admin/reset-password page) — a new staff member sets their own
 * initial password rather than a Super Admin choosing one for them
 * and having to transmit it some other way.
 */
export function staffWelcomeEmail(name: string, roleLabel: string, setupUrl: string): EmailContent {
  return {
    subject: "Your AAICBI staff account is ready",
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">An AAICBI staff account has been created for you, with <strong>${escapeHtml(roleLabel)}</strong> access. Set your password to get started.</p>
      ${button(setupUrl, "Set Your Password")}
      <p style="margin:0;font-size:13px;color:#666;">This link expires in 48 hours.</p>
    `),
    text: `Hi ${name},\n\nAn AAICBI staff account has been created for you, with ${roleLabel} access. Set your password to get started.\n\n${setupUrl}\n\nThis link expires in 48 hours.`,
  };
}

/**
 * Audit finding, closed here: a genuinely new payment succeeding
 * while the trainee's existing access for the same course still has
 * substantial time remaining is a strong signal of an accidental
 * double-payment (a double-click, two open tabs), not a normal
 * renewal — a real renewal happens right as the prior period ends,
 * not with weeks or months still on the clock. This can't be
 * prevented outright without contradicting this project's own
 * deliberate choice not to hold a "pending" row that could get stuck
 * on an abandoned checkout (see initializeCoursePayment's own
 * comment) — so this is the honest fallback: flag it for a real
 * person to look at and refund if it genuinely was one, rather than
 * the money just disappearing into a log line nobody reads.
 */
export interface LikelyDuplicatePaymentEmailInput {
  traineeName: string;
  traineeEmail: string;
  courseTitle: string;
  newReference: string;
  currentPeriodEnd: string;
}
export function likelyDuplicatePaymentEmail(input: LikelyDuplicatePaymentEmailInput): EmailContent {
  return {
    subject: `Possible duplicate payment — ${input.traineeName}`,
    html: wrapHtml(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${escapeHtml(input.traineeName)}</strong> (${escapeHtml(input.traineeEmail)}) just paid for <strong>${escapeHtml(input.courseTitle)}</strong>, but their existing access doesn't expire until ${escapeHtml(input.currentPeriodEnd)}.</p>
      <p style="margin:0 0 16px;">This usually means a duplicate charge (a double-click, or two tabs both completing checkout), not a genuine renewal. Reference: ${escapeHtml(input.newReference)}.</p>
      <p style="margin:0;">Worth checking Paystack's dashboard directly and refunding if it was genuinely a duplicate.</p>
    `),
    text: `${input.traineeName} (${input.traineeEmail}) just paid for ${input.courseTitle}, but their existing access doesn't expire until ${input.currentPeriodEnd}.\n\nThis usually means a duplicate charge, not a genuine renewal. Reference: ${input.newReference}.\n\nWorth checking Paystack's dashboard directly and refunding if it was genuinely a duplicate.`,
  };
}
